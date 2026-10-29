const crypto = require('crypto');
// Reuses the exact same job runner as the existing Students.jsx bulk-import
// (backend/routes/nifStudentRoutes.js POST /students/bulk) instead of
// reimplementing password hashing, roll allocation, parent auto-creation, and
// fee auto-assignment.
const { bulkImportJobs, runBulkImportJob } = require('../../routes/nifStudentRoutes');

const REQUIRED_FIELDS = ['name', 'class', 'section'];

// rows: same shape as the existing Students.jsx bulk-import payload (name,
// class, section, admissionDate, gender, mobile, guardian/father/mother
// fields, etc.) — requires the target Class to already exist (import Classes
// first) since runBulkImportJob validates row.class against real Class docs.
const run = (rows, { schoolId, campusId, admin, isSuperAdmin, campusName, campusType }) => {
  const jobId = crypto.randomUUID();

  bulkImportJobs.set(jobId, {
    schoolId: String(schoolId),
    status: 'processing',
    total: rows.length,
    processed: 0,
    results: { imported: 0, failed: 0, errors: [], warnings: [] },
    createdAt: Date.now(),
  });

  runBulkImportJob(jobId, {
    students: rows,
    schoolId,
    campusId,
    admin,
    isSuperAdmin,
    campusName,
    campusType,
  }).catch(() => {});

  return { jobId, jobSystem: 'student' };
};

module.exports = { requiredFields: REQUIRED_FIELDS, run };
