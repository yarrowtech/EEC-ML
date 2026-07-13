const { logger } = require('../utils/logger');

const SENSITIVE_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'token',
  'authorization',
  'secret',
  'apikey',
  'keysecret',
  'webhooksecret',
]);

const isSensitiveKey = (key) => {
  const normalized = String(key || '').toLowerCase();
  return SENSITIVE_KEYS.has(normalized)
    || normalized.endsWith('password')
    || normalized.endsWith('secret')
    || normalized.endsWith('token');
};

const sanitizeValue = (value, depth = 0) => {
  if (depth > 3) return '[truncated]';
  if (typeof value === 'string') {
    return value.length > 500 ? `${value.slice(0, 500)}...[truncated]` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  }
  if (!value || typeof value !== 'object') return value;
  const output = {};
  Object.entries(value).forEach(([key, val]) => {
    if (isSensitiveKey(key)) {
      output[key] = '[redacted]';
      return;
    }
    output[key] = sanitizeValue(val, depth + 1);
  });
  return output;
};

const resolveActor = (req) => {
  if (req?.admin?.id) {
    return {
      actorId: String(req.admin.id),
      actorType: req.isSuperAdmin ? 'super_admin' : 'admin',
      schoolId: req.schoolId || req.admin.schoolId || null,
      campusId: req.campusId || req.admin.campusId || null,
    };
  }
  return {
    actorType: 'anonymous',
  };
};

const adminActionLogger = (req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const actor = resolveActor(req);

    logger.log({
      level,
      message: 'Admin portal action',
      event: 'admin_portal_action',
      requestId: req.requestId || undefined,
      method: req.method,
      path: req.originalUrl,
      statusCode,
      durationMs: Date.now() - startedAt,
      query: sanitizeValue(req.query || {}),
      params: sanitizeValue(req.params || {}),
      body: sanitizeValue(req.body || {}),
      ...actor,
    });
  });

  next();
};

module.exports = adminActionLogger;
