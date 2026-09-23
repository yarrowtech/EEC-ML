const AcademicYear = require('../../models/AcademicYear');
const { createJob, recordSuccess, recordFailure, completeJob, failJob } = require('../../utils/backgroundJob');
const { normalizeKey, parseDate } = require('./shared');

const REQUIRED_FIELDS = ['name'];

// rows: [{ name, startDate?, endDate?, isActive? }]
const run = (rows, { schoolId }) => {
  const jobId = createJob(rows.length);

  (async () => {
    try {
      const existing = await AcademicYear.find({ schoolId }).select('name').lean();
      const existingKeys = new Set(existing.map((year) => normalizeKey(year.name)));
      let activeRowIndex = -1;

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] || {};
        try {
          const name = String(row.name || '').trim();
          if (!name) throw new Error('name is required');
          const key = normalizeKey(name);
          if (existingKeys.has(key)) throw new Error(`Academic year "${name}" already exists for this school`);

          const isActive = String(row.isActive || '').trim().toLowerCase() === 'true' || row.isActive === true;
          const created = await AcademicYear.create({
            schoolId,
            name,
            startDate: parseDate(row.startDate),
            endDate: parseDate(row.endDate),
            isActive,
            status: isActive ? 'active' : 'upcoming',
          });
          existingKeys.add(key);
          if (isActive) activeRowIndex = created._id;
          recordSuccess(jobId);
        } catch (err) {
          recordFailure(jobId, { index: i, message: err.message });
        }
      }

      // Only one academic year may be active — the last row that requested it wins.
      if (activeRowIndex) {
        await AcademicYear.updateMany(
          { schoolId, _id: { $ne: activeRowIndex } },
          { $set: { isActive: false } }
        );
      }

      completeJob(jobId);
    } catch (err) {
      failJob(jobId, err);
    }
  })();

  return { jobId, jobSystem: 'generic' };
};

module.exports = { requiredFields: REQUIRED_FIELDS, run };
