const express = require('express');
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth');
const Admin = require('../models/Admin');
const School = require('../models/School');
const MigrationBatch = require('../models/MigrationBatch');
const backgroundJob = require('../utils/backgroundJob');
const nifStudentRoutes = require('./nifStudentRoutes');
const adminUserManagement = require('./adminUserManagement');
const { ENTITY_IMPORTERS, ENTITY_ORDER } = require('../services/migration');

const router = express.Router();

// Same guard as every other route in superAdminRoutes.js — duplicated
// locally rather than exported from there since it's a one-line check.
const ensureSuperAdmin = (req, res, next) => {
  if (!req.isSuperAdmin) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  return next();
};

const MAX_ROWS_PER_IMPORT = 5000;

// Normalizes the three different job-store shapes (this module's own
// backgroundJob store, plus the reused student/teacher bulk-job stores) into
// one response shape for the frontend to poll.
const resolveJobStatus = (jobSystem, jobId) => {
  if (jobSystem === 'student') {
    const job = nifStudentRoutes.bulkImportJobs.get(jobId);
    if (!job) return null;
    return {
      status: job.status,
      total: job.total,
      processed: job.processed,
      succeeded: job.results.imported,
      failed: job.results.failed,
      errors: job.results.errors,
      warnings: job.results.warnings,
      error: job.error,
    };
  }
  if (jobSystem === 'teacher') {
    const job = adminUserManagement.teacherBulkUploadJobs.get(jobId);
    if (!job) return null;
    return {
      status: job.status,
      total: job.total,
      processed: job.processed,
      succeeded: job.created,
      failed: job.failed,
      errors: job.errors,
      warnings: [],
      error: job.error,
    };
  }
  const job = backgroundJob.getJob(jobId);
  if (!job) return null;
  return {
    status: job.status,
    total: job.total,
    processed: job.processed,
    succeeded: job.succeeded,
    failed: job.failed,
    errors: job.errors,
    warnings: job.warnings,
    error: job.error,
  };
};

// Bridges a fire-and-forget background job back onto the persisted
// MigrationBatch once it finishes, so the batch doc (and thus the "resume
// where I left off" UI) reflects the real outcome without the job systems
// themselves needing to know about MigrationBatch.
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_MS = 20 * 60 * 1000;
const watchJobForBatch = ({ schoolId, type, jobId, jobSystem }) => {
  const startedAt = Date.now();
  const tick = async () => {
    const jobStatus = resolveJobStatus(jobSystem, jobId);
    const timedOut = Date.now() - startedAt > MAX_POLL_MS;
    if (!jobStatus || jobStatus.status === 'completed' || jobStatus.status === 'failed' || timedOut) {
      const finalStatus = !jobStatus || timedOut ? 'failed' : jobStatus.status;
      await MigrationBatch.updateOne(
        { schoolId, 'entities.type': type },
        {
          $set: {
            'entities.$.status': finalStatus,
            'entities.$.imported': jobStatus?.succeeded || 0,
            'entities.$.failed': jobStatus?.failed || 0,
            'entities.$.errorSample': (jobStatus?.errors || []).slice(0, 50),
          },
        }
      ).catch(() => {});
      return;
    }
    setTimeout(tick, POLL_INTERVAL_MS).unref?.();
  };
  setTimeout(tick, POLL_INTERVAL_MS).unref?.();
};

router.get('/schools/:schoolId/status', adminAuth, ensureSuperAdmin, async (req, res) => {
  try {
    const { schoolId } = req.params;
    if (!mongoose.isValidObjectId(schoolId)) return res.status(400).json({ error: 'Invalid schoolId' });
    const school = await School.findById(schoolId).select('name').lean();
    if (!school) return res.status(404).json({ error: 'School not found' });

    const batch = await MigrationBatch.findOne({ schoolId }).lean();
    res.json({
      schoolId,
      schoolName: school.name,
      campusId: batch?.campusId || null,
      entityOrder: ENTITY_ORDER,
      entities: batch?.entities || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load migration status' });
  }
});

router.post('/schools/:schoolId/entities/:type/import', adminAuth, ensureSuperAdmin, async (req, res) => {
  try {
    const { schoolId, type } = req.params;
    if (!mongoose.isValidObjectId(schoolId)) return res.status(400).json({ error: 'Invalid schoolId' });

    const importer = ENTITY_IMPORTERS[type];
    if (!importer) return res.status(400).json({ error: `Unknown entity type "${type}"` });

    const school = await School.findById(schoolId).select('name').lean();
    if (!school) return res.status(404).json({ error: 'School not found' });

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ error: 'rows array is required' });
    if (rows.length > MAX_ROWS_PER_IMPORT) {
      return res.status(413).json({
        error: `Too many rows in one request (max ${MAX_ROWS_PER_IMPORT}). Split the file into smaller batches.`,
      });
    }

    const campusId = req.body?.campusId ? String(req.body.campusId).trim() : null;

    let batch = await MigrationBatch.findOne({ schoolId });
    if (!batch) {
      batch = await MigrationBatch.create({ schoolId, campusId, createdBy: req.admin?.id, entities: [] });
    }

    const missingDependency = importer.dependsOn.find((dep) => {
      const depEntity = batch.entities.find((entity) => entity.type === dep);
      return !depEntity || depEntity.status !== 'completed';
    });
    if (missingDependency) {
      return res.status(409).json({
        error: `Import "${ENTITY_IMPORTERS[missingDependency].label}" before "${importer.label}"`,
      });
    }

    // Resolve the target school's own admin so generated codes (student
    // username prefix, teacher employeeCode prefix) match what that school
    // would get from a normal bulk upload — not the super admin's identity.
    const adminFilter = campusId ? { schoolId, campusId } : { schoolId };
    const schoolAdmin =
      (await Admin.findOne(adminFilter).select('username campusName campusType').lean()) ||
      (await Admin.findOne({ schoolId }).select('username campusName campusType').lean());

    const ctx = {
      schoolId,
      campusId,
      admin: schoolAdmin ? { username: schoolAdmin.username } : null,
      isSuperAdmin: false,
      campusName: schoolAdmin?.campusName || null,
      campusType: schoolAdmin?.campusType || null,
    };

    const { jobId, jobSystem } = importer.run(rows, ctx);

    let entityRecord = batch.entities.find((entity) => entity.type === type);
    if (!entityRecord) {
      batch.entities.push({ type, status: 'importing', totalRows: rows.length, imported: 0, failed: 0, errorSample: [] });
      entityRecord = batch.entities.find((entity) => entity.type === type);
    } else {
      entityRecord.status = 'importing';
      entityRecord.totalRows = rows.length;
      entityRecord.imported = 0;
      entityRecord.failed = 0;
      entityRecord.errorSample = [];
    }
    entityRecord.lastJobId = jobId;
    entityRecord.lastRunAt = new Date();
    if (campusId) batch.campusId = campusId;
    await batch.save();

    watchJobForBatch({ schoolId, type, jobId, jobSystem });

    return res.status(202).json({ jobId, jobSystem, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to start import' });
  }
});

router.get('/jobs/:jobId/status', adminAuth, ensureSuperAdmin, (req, res) => {
  const jobSystem = String(req.query?.system || 'generic');
  const status = resolveJobStatus(jobSystem, req.params.jobId);
  if (!status) return res.status(404).json({ error: 'Job not found' });
  res.json(status);
});

module.exports = router;
