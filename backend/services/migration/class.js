const ClassModel = require('../../models/Class');
const AcademicYear = require('../../models/AcademicYear');
const { createJob, recordSuccess, recordFailure, addWarning, completeJob, failJob } = require('../../utils/backgroundJob');
const { normalizeKey, buildLookupMap } = require('./shared');

const REQUIRED_FIELDS = ['name'];

// rows: [{ name, academicYear?, order?, stream? }]
// academicYear falls back to the school's active year when omitted — most
// migrations run Academic Year first, so this is usually implicit.
const run = (rows, { schoolId, campusId }) => {
  const jobId = createJob(rows.length);

  (async () => {
    try {
      const yearFilter = { schoolId };
      const years = await AcademicYear.find(yearFilter).select('name isActive').lean();
      const yearByName = buildLookupMap(years, (y) => y.name);
      const activeYear = years.find((y) => y.isActive) || null;

      const classFilter = { schoolId };
      if (campusId) classFilter.campusId = campusId;
      const existingClasses = await ClassModel.find(classFilter).select('name academicYearId').lean();
      const existingKeys = new Set(
        existingClasses.map((c) => `${normalizeKey(c.name)}::${c.academicYearId ? String(c.academicYearId) : ''}`)
      );

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] || {};
        try {
          const name = String(row.name || '').trim();
          if (!name) throw new Error('name is required');

          let academicYearId = null;
          const yearName = String(row.academicYear || '').trim();
          if (yearName) {
            const yearDoc = yearByName.get(normalizeKey(yearName));
            if (!yearDoc) throw new Error(`Academic year "${yearName}" not found — import Academic Years first`);
            academicYearId = yearDoc._id;
          } else if (activeYear) {
            academicYearId = activeYear._id;
          }

          const dedupeKey = `${normalizeKey(name)}::${academicYearId ? String(academicYearId) : ''}`;
          if (existingKeys.has(dedupeKey)) throw new Error(`Class "${name}" already exists for this year`);

          const standardMatch = name.match(/(\d{1,2})/);
          const standard = standardMatch ? Number(standardMatch[1]) : undefined;

          await ClassModel.create({
            schoolId,
            campusId: campusId || null,
            name,
            academicYearId: academicYearId || undefined,
            order: Number.isFinite(Number(row.order)) ? Number(row.order) : 0,
            standard: standard && standard >= 1 && standard <= 12 ? standard : undefined,
          });
          existingKeys.add(dedupeKey);
          if (!academicYearId) addWarning(jobId, `Row ${i + 1} ("${name}"): created without an academic year`);
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
