const AuditLog = require('../models/AuditLog');
const { logger } = require('./logger');

/**
 * Persist a durable audit record for a super-admin (platform-level) action.
 * Complements the Pino admin action logs with a queryable database trail:
 * actor, action, target, IP and timestamp survive log rotation.
 *
 * Never throws — audit failures are logged but must not break the request.
 */
const recordPlatformAudit = async (req, { action, entity, entityId, schoolId, meta } = {}) => {
  try {
    await AuditLog.create({
      schoolId: schoolId || null,
      actorId: req?.admin?.id || req?.admin?._id || undefined,
      actorType: req?.isSuperAdmin ? 'super_admin' : 'admin',
      actorName: req?.admin?.username || req?.admin?.name || undefined,
      action,
      entity,
      entityId: entityId || undefined,
      ip: req?.ip || req?.socket?.remoteAddress || undefined,
      meta,
    });
  } catch (err) {
    logger.warn({
      message: 'Failed to write platform audit log',
      event: 'platform_audit_write_failed',
      action,
      reason: err?.message,
    });
  }
};

module.exports = { recordPlatformAudit };
