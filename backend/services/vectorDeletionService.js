const axios = require('axios');
const PendingVectorDeletion = require('../models/PendingVectorDeletion');
const { logger } = require('../utils/logger');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const MAX_ATTEMPTS = 8;

async function queueVectorDeletion(materialId, schoolId = null, error = null) {
  if (!materialId) return null;
  return PendingVectorDeletion.findOneAndUpdate(
    { materialId, status: { $in: ['pending', 'processing', 'failed'] } },
    { $set: { schoolId, status: 'pending', nextAttemptAt: new Date(), lastError: error ? String(error.message || error) : '' }, $inc: { attempts: 0 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function processPendingVectorDeletions({ limit = 25 } = {}) {
  const now = new Date();
  const staleProcessingCutoff = new Date(Date.now() - 30 * 60 * 1000);
  const due = await PendingVectorDeletion.find({
    attempts: { $lt: MAX_ATTEMPTS },
    $or: [
      { status: { $in: ['pending', 'failed'] }, nextAttemptAt: { $lte: now } },
      { status: 'processing', updatedAt: { $lte: staleProcessingCutoff } },
    ],
  }).sort({ nextAttemptAt: 1 }).limit(limit);
  let completed = 0;
  for (const job of due) {
    job.status = 'processing';
    job.attempts += 1;
    await job.save();
    try {
      await axios.delete(`${AI_SERVICE_URL}/ingest/material/${encodeURIComponent(String(job.materialId))}`, { timeout: 60_000 });
      job.status = 'complete';
      job.completedAt = new Date();
      job.lastError = '';
      await job.save();
      completed += 1;
    } catch (err) {
      job.status = job.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
      job.lastError = String(err.response?.data?.detail || err.message || err).slice(0, 1000);
      job.nextAttemptAt = new Date(Date.now() + Math.min(60 * 60 * 1000, 2 ** job.attempts * 60 * 1000));
      await job.save();
      logger.warn({ materialId: String(job.materialId), attempts: job.attempts, err: job.lastError }, 'vector deletion retry failed');
    }
  }
  return { inspected: due.length, completed };
}

module.exports = { queueVectorDeletion, processPendingVectorDeletions, MAX_ATTEMPTS };
