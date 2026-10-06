const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  materialId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', default: null, index: true },
  status: { type: String, enum: ['pending', 'processing', 'failed', 'complete'], default: 'pending', index: true },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  lastError: { type: String, default: '' },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

schema.index({ materialId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['pending', 'processing', 'failed'] } } });

module.exports = mongoose.model('PendingVectorDeletion', schema);
