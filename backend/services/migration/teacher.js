const crypto = require('crypto');
// Reuses the exact same job runner as the existing Teachers.jsx bulk-upload
// button (backend/routes/adminUserManagement.js POST /teachers/bulk-upload)
// instead of reimplementing employeeCode/username generation and the
// password-policy check.
const { teacherBulkUploadJobs, runTeacherBulkUploadJob } = require('../../routes/adminUserManagement');

const REQUIRED_FIELDS = ['name'];

// rows: [{ name, email?, mobile?, gender?, password? }] — same shape the
// existing teacher bulk-upload UI sends.
const run = (rows, { schoolId, campusId, campusName, campusType, admin }) => {
  const jobId = crypto.randomUUID();
  const campusContext = {
    campusId: campusId || null,
    campusName: campusName || null,
    campusType: campusType || null,
  };

  teacherBulkUploadJobs.set(jobId, {
    schoolId: String(schoolId),
    status: 'processing',
    total: rows.length,
    processed: 0,
    created: 0,
    failed: 0,
    errors: [],
    createdAt: Date.now(),
  });

  // runTeacherBulkUploadJob records failures on the job itself and never
  // rethrows past its own try/catch — this .catch is just a safety net
  // against an unhandled rejection.
  runTeacherBulkUploadJob(jobId, {
    users: rows,
    resolvedSchoolId: schoolId,
    campusContext,
    adminUsername: admin?.username || '',
  }).catch(() => {});

  return { jobId, jobSystem: 'teacher' };
};

module.exports = { requiredFields: REQUIRED_FIELDS, run };
