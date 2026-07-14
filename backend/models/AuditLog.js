const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    // Null for platform-level (super admin) actions that are not tied to a tenant.
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null },
    actorId: { type: mongoose.Schema.Types.ObjectId },
    actorType: { type: String, trim: true },
    actorName: { type: String, trim: true },
    action: { type: String, required: true, trim: true },
    entity: { type: String, trim: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    ip: { type: String, trim: true },
    meta: { type: Object },
  },
  { timestamps: true }
);

auditLogSchema.index({ actorType: 1, createdAt: -1 });
auditLogSchema.index({ schoolId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
