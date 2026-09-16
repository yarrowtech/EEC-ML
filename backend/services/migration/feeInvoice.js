const FeeInvoice = require('../../models/FeeInvoice');
const FeeStructure = require('../../models/FeeStructure');
const StudentUser = require('../../models/StudentUser');
const { createJob, recordSuccess, recordFailure, completeJob, failJob } = require('../../utils/backgroundJob');
const { normalizeKey, buildLookupMap, parseAmount, parseDate } = require('./shared');

const REQUIRED_FIELDS = ['student', 'feeStructure'];

// rows: [{ student, feeStructure, totalAmount?, paidAmount?, dueDate? }]
// `student` matches admissionNumber, studentCode, or username (whichever the
// old system's export used as its student identifier). `totalAmount`
// defaults to the fee structure's totalAmount when omitted. Only the current
// outstanding balance is imported — no payment/receipt history (see the plan
// for why that's out of scope for v1).
const run = (rows, { schoolId }) => {
  const jobId = createJob(rows.length);

  (async () => {
    try {
      const structures = await FeeStructure.find({ schoolId }).select('name totalAmount').lean();
      const structureByName = buildLookupMap(structures, (s) => s.name);

      const students = await StudentUser.find({ schoolId })
        .select('admissionNumber studentCode username grade section')
        .lean();
      const studentByKey = new Map();
      students.forEach((student) => {
        [student.admissionNumber, student.studentCode, student.username].forEach((identifier) => {
          const key = normalizeKey(identifier);
          if (key && !studentByKey.has(key)) studentByKey.set(key, student);
        });
      });

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] || {};
        try {
          const studentKey = String(row.student || '').trim();
          if (!studentKey) throw new Error('student is required');
          const studentDoc = studentByKey.get(normalizeKey(studentKey));
          if (!studentDoc) throw new Error(`Student "${studentKey}" not found — import Students first`);

          const structureName = String(row.feeStructure || '').trim();
          if (!structureName) throw new Error('feeStructure is required');
          const structureDoc = structureByName.get(normalizeKey(structureName));
          if (!structureDoc) throw new Error(`Fee structure "${structureName}" not found — import Fee Structures first`);

          const totalAmount = parseAmount(row.totalAmount) ?? structureDoc.totalAmount;
          const paidAmount = parseAmount(row.paidAmount) ?? 0;
          if (paidAmount > totalAmount) throw new Error('paidAmount cannot exceed totalAmount');
          const balanceAmount = totalAmount - paidAmount;
          const status = balanceAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'due';

          await FeeInvoice.create({
            schoolId,
            classId: undefined,
            className: studentDoc.grade || '',
            section: studentDoc.section || '',
            studentId: studentDoc._id,
            feeStructureId: structureDoc._id,
            title: structureName,
            totalAmount,
            paidAmount,
            balanceAmount,
            feeHeadsSnapshot: [{ label: 'Total Fee', amount: totalAmount }],
            status,
            dueDate: parseDate(row.dueDate),
          });
          recordSuccess(jobId);
        } catch (err) {
          recordFailure(jobId, { index: i, message: err.message });
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
