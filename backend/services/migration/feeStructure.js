const FeeStructure = require('../../models/FeeStructure');
const AcademicYear = require('../../models/AcademicYear');
const ClassModel = require('../../models/Class');
const { createJob, recordSuccess, recordFailure, completeJob, failJob } = require('../../utils/backgroundJob');
const { normalizeKey, buildLookupMap, parseAmount } = require('./shared');

const REQUIRED_FIELDS = ['name', 'totalAmount'];

// rows: [{ name, totalAmount, academicYear?, class?, lateFeeAmount?, feeHeadLabel? }]
// One feeHead per structure (feeHeadLabel, defaulting to "Total Fee") — the
// old system's fee-head breakdown, if any, isn't modeled here; a school can
// split it further by hand afterwards.
const run = (rows, { schoolId }) => {
  const jobId = createJob(rows.length);

  (async () => {
    try {
      const years = await AcademicYear.find({ schoolId }).select('name isActive').lean();
      const yearByName = buildLookupMap(years, (y) => y.name);
      const activeYear = years.find((y) => y.isActive) || null;

      const classes = await ClassModel.find({ schoolId }).select('name').lean();
      const classByName = buildLookupMap(classes, (c) => c.name);

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] || {};
        try {
          const name = String(row.name || '').trim();
          if (!name) throw new Error('name is required');
          const totalAmount = parseAmount(row.totalAmount);
          if (totalAmount === null) throw new Error('totalAmount must be a non-negative number');

          let academicYearId;
          const yearName = String(row.academicYear || '').trim();
          if (yearName) {
            const yearDoc = yearByName.get(normalizeKey(yearName));
            if (!yearDoc) throw new Error(`Academic year "${yearName}" not found — import Academic Years first`);
            academicYearId = yearDoc._id;
          } else if (activeYear) {
            academicYearId = activeYear._id;
          }

          let classId;
          let className = '';
          const rowClassName = String(row.class || '').trim();
          if (rowClassName) {
            const classDoc = classByName.get(normalizeKey(rowClassName));
            if (!classDoc) throw new Error(`Class "${rowClassName}" not found — import Classes first`);
            classId = classDoc._id;
            className = classDoc.name;
          }

          const lateFeeAmount = parseAmount(row.lateFeeAmount) ?? 0;
          const feeHeadLabel = String(row.feeHeadLabel || '').trim() || 'Total Fee';

          await FeeStructure.create({
            schoolId,
            academicYearId,
            classId,
            className,
            name,
            totalAmount,
            lateFeeAmount,
            feeHeads: [{ label: feeHeadLabel, amount: totalAmount }],
            isActive: true,
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
