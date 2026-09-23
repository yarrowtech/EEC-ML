const StudentUser = require('../../models/StudentUser');
const { createJob, recordSuccess, recordFailure, completeJob, failJob } = require('../../utils/backgroundJob');
const { normalizeKey, parseDate } = require('./shared');

const REQUIRED_FIELDS = ['student', 'date', 'status'];
const VALID_STATUSES = new Set(['present', 'absent']);
const BULK_WRITE_BATCH = 200;

// rows: [{ student, date, status, subject? }]
// Student attendance is an embedded array on StudentUser (models/StudentUser.js
// `attendance`), not a separate collection — rows are grouped per student and
// appended via one $push per student, batched through bulkWrite.
const run = (rows, { schoolId }) => {
  const jobId = createJob(rows.length);

  (async () => {
    try {
      const students = await StudentUser.find({ schoolId })
        .select('admissionNumber studentCode username')
        .lean();
      const studentByKey = new Map();
      students.forEach((student) => {
        [student.admissionNumber, student.studentCode, student.username].forEach((identifier) => {
          const key = normalizeKey(identifier);
          if (key && !studentByKey.has(key)) studentByKey.set(key, student);
        });
      });

      // studentId -> array of { rowIndex, entry }
      const entriesByStudent = new Map();

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] || {};
        try {
          const studentKey = String(row.student || '').trim();
          if (!studentKey) throw new Error('student is required');
          const studentDoc = studentByKey.get(normalizeKey(studentKey));
          if (!studentDoc) throw new Error(`Student "${studentKey}" not found — import Students first`);

          const date = parseDate(row.date);
          if (!date) throw new Error('date is invalid');

          const status = normalizeKey(row.status);
          if (!VALID_STATUSES.has(status)) throw new Error('status must be "present" or "absent"');

          const entry = { date, status, subject: String(row.subject || '').trim() || undefined };
          const key = String(studentDoc._id);
          if (!entriesByStudent.has(key)) entriesByStudent.set(key, []);
          entriesByStudent.get(key).push({ rowIndex: i, entry });
        } catch (err) {
          recordFailure(jobId, { index: i, message: err.message });
        }
      }

      const studentIds = Array.from(entriesByStudent.keys());
      for (let s = 0; s < studentIds.length; s += BULK_WRITE_BATCH) {
        const batchIds = studentIds.slice(s, s + BULK_WRITE_BATCH);
        const operations = batchIds.map((studentId) => ({
          updateOne: {
            filter: { _id: studentId },
            update: { $push: { attendance: { $each: entriesByStudent.get(studentId).map((r) => r.entry) } } },
          },
        }));
        try {
          await StudentUser.bulkWrite(operations, { ordered: false });
          batchIds.forEach((studentId) => {
            entriesByStudent.get(studentId).forEach(() => recordSuccess(jobId));
          });
        } catch (err) {
          batchIds.forEach((studentId) => {
            entriesByStudent.get(studentId).forEach(({ rowIndex }) => {
              recordFailure(jobId, { index: rowIndex, message: err.message || 'Failed to write attendance' });
            });
          });
        }
      }

      completeJob(jobId);
    } catch (err) {
      failJob(jobId, err);
    }
  })();

  return { jobId, jobSystem: 'generic' };
};

module.exports = { requiredFields: REQUIRED_FIELDS, run };
