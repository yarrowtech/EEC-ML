const mongoose = require('../utils/registerTenantPlugin');

const paymentAuditSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

paymentAuditSchema.index({ organizationId: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentAudit', paymentAuditSchema);
