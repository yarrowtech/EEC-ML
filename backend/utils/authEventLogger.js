const { logger } = require('./logger');
const { getRequestNetworkContext } = require('./request');
const { logSecurityEvent } = require('./securityEventLogger');

const asString = (value) => {
  if (value === undefined || value === null) return undefined;
  return String(value);
};

const isAdminPortalPath = (req) => {
  const url = String(req?.originalUrl || '');
  return url.startsWith('/api/admin') || url.startsWith('/api/super-admin');
};

const isAuthRoute = (req) => {
  const url = String(req?.originalUrl || '');
  return url.includes('/auth/');
};

const isAdminUserType = (userType) => {
  const normalized = String(userType || '').toLowerCase();
  return normalized === 'admin' || normalized === 'super_admin' || normalized === 'superadmin';
};

const logAuthEvent = (req, payload = {}) => {
  const {
    action = 'auth.unknown',
    outcome = 'success',
    userType = 'unknown',
    identifier,
    userId,
    schoolId,
    campusId,
    reason,
    statusCode,
    ...extra
  } = payload;

  if (!isAdminPortalPath(req) && !isAuthRoute(req) && !isAdminUserType(userType)) {
    return;
  }

  const level = outcome === 'failure' ? 'warn' : 'info';
  const net = getRequestNetworkContext(req);

  logger.log({
    level,
    message: 'Auth event',
    event: 'auth_event',
    action,
    outcome,
    userType,
    identifier: asString(identifier),
    userId: asString(userId),
    schoolId: asString(schoolId),
    campusId: asString(campusId),
    reason: asString(reason),
    statusCode,
    requestId: req?.requestId || undefined,
    traceId: req?.traceId || undefined,
    method: req?.method,
    path: req?.originalUrl,
    ip: net.clientIp,
    remoteIp: net.remoteIp,
    ipSource: net.source,
    forwardedForChain: net.forwardedChain,
    forwardedForCount: net.forwardedCount,
    ...extra,
  });

  if (outcome === 'failure' && String(action).toLowerCase().includes('login')) {
    logSecurityEvent(req, {
      action: 'security.auth_failure_detected',
      outcome: 'observed',
      severity: 'medium',
      attack_type: 'bruteforce_or_auth_abuse',
      riskScore: 65,
      reason: asString(reason) || 'Failed login attempt',
      statusCode,
      authAction: action,
      authUserType: userType,
      identifier: asString(identifier),
    });
  }
};

module.exports = { logAuthEvent };
