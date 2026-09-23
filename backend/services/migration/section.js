const Section = require('../../models/Section');
const ClassModel = require('../../models/Class');
const { createJob, recordSuccess, recordFailure, completeJob, failJob } = require('../../utils/backgroundJob');
const { normalizeKey, buildLookupMap } = require('./shared');

const REQUIRED_FIELDS = ['class', 'name'];

// rows: [{ class, name }] — class is the Class.name to attach this section to.
const run = (rows, { schoolId, campusId }) => {
  const jobId = createJob(rows.length);

  (async () => {
    try {
      const classFilter = { schoolId };
      if (campusId) classFilter.campusId = campusId;
      const classes = await ClassModel.find(classFilter).select('name').lean();
      const classByName = buildLookupMap(classes, (c) => c.name);

      const sectionFilter = { schoolId };
      if (campusId) sectionFilter.campusId = campusId;
      const existingSections = await Section.find(sectionFilter).select('name classId').lean();
      const existingKeys = new Set(
        existingSections.map((s) => `${String(s.classId)}::${normalizeKey(s.name)}`)
      );

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] || {};
        try {
          const className = String(row.class || '').trim();
          const name = String(row.name || '').trim();
          if (!className) throw new Error('class is required');
          if (!name) throw new Error('name is required');

          const classDoc = classByName.get(normalizeKey(className));
          if (!classDoc) throw new Error(`Class "${className}" not found — import Classes first`);

          const dedupeKey = `${String(classDoc._id)}::${normalizeKey(name)}`;
          if (existingKeys.has(dedupeKey)) throw new Error(`Section "${name}" already exists for class "${className}"`);

          await Section.create({
            schoolId,
            campusId: campusId || null,
            classId: classDoc._id,
            name,
          });
          existingKeys.add(dedupeKey);
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
