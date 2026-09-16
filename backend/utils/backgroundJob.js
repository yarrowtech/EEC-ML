const crypto = require('crypto');

// Generic in-memory job-with-polling store, used by the data-migration
// importers (backend/services/migration/*.js). Mirrors the pattern already
// used 3x in this codebase (nifStudentRoutes.js bulkImportJobs,
// adminUserManagement.js teacherBulkUploadJobs/bulkDeleteJobs) — factored out
// here because the migration portal adds several more entity types that all
// need the same create/poll/expire behavior.
const jobs = new Map();
const DEFAULT_TTL_MS = 30 * 60 * 1000;
const MAX_TRACKED_ERRORS = 200;
const MAX_TRACKED_WARNINGS = 200;

const createJob = (total) => {
  const jobId = crypto.randomUUID();
  jobs.set(jobId, {
    status: 'processing',
    total,
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
    warnings: [],
    createdAt: Date.now(),
  });
  return jobId;
};

const getJob = (jobId) => jobs.get(jobId) || null;

const recordSuccess = (jobId) => {
  const job = jobs.get(jobId);
  if (!job) return;
  job.succeeded += 1;
  job.processed += 1;
};

const recordFailure = (jobId, { index, message } = {}) => {
  const job = jobs.get(jobId);
  if (!job) return;
  job.failed += 1;
  job.processed += 1;
  if (job.errors.length < MAX_TRACKED_ERRORS) {
    job.errors.push({ index, message: message || 'Import failed' });
  }
};

const addWarning = (jobId, message) => {
  const job = jobs.get(jobId);
  if (!job || !message) return;
  if (job.warnings.length < MAX_TRACKED_WARNINGS) job.warnings.push(message);
};

const completeJob = (jobId, { ttlMs = DEFAULT_TTL_MS } = {}) => {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = 'completed';
  job.finishedAt = Date.now();
  setTimeout(() => jobs.delete(jobId), ttlMs).unref?.();
};

const failJob = (jobId, err, { ttlMs = DEFAULT_TTL_MS } = {}) => {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = 'failed';
  job.error = err?.message || 'Job failed';
  job.finishedAt = Date.now();
  setTimeout(() => jobs.delete(jobId), ttlMs).unref?.();
};

module.exports = {
  createJob,
  getJob,
  recordSuccess,
  recordFailure,
  addWarning,
  completeJob,
  failJob,
};
