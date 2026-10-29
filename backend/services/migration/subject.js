const Subject = require('../../models/Subject');
const ClassModel = require('../../models/Class');
const { createJob, recordSuccess, recordFailure, completeJob, failJob } = require('../../utils/backgroundJob');
const { normalizeKey, buildLookupMap } = require('./shared');

const REQUIRED_FIELDS = ['name'];

// rows: [{ name, class?, code? }] — class is optional (a school-wide subject
// when omitted), same as the single-create form (Subject.classId isn't
// required at the model level).
const run = (rows, { schoolId, campusId }) => {
  const jobId = createJob(rows.length);

  (async () => {
    try {
      const classFilter = { schoolId };
      if (campusId) classFilter.campusId = campusId;
      const classes = await ClassModel.find(classFilter).select('name').lean();
      const classByName = buildLookupMap(classes, (c) => c.name);

      const subjectFilter = { schoolId };
      if (campusId) subjectFilter.campusId = campusId;
      const existingSubjects = await Subject.find(subjectFilter).select('name classId').lean();
      const existingKeys = new Set(
        existingSubjects.map((s) => `${s.classId ? String(s.classId) : ''}::${normalizeKey(s.name)}`)
      );

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] || {};
        try {
          const name = String(row.name || '').trim();
          if (!name) throw new Error('name is required');

          let classId = null;
          const className = String(row.class || '').trim();
          if (className) {
            const classDoc = classByName.get(normalizeKey(className));
            if (!classDoc) throw new Error(`Class "${className}" not found — import Classes first`);
            classId = classDoc._id;
          }

          const dedupeKey = `${classId ? String(classId) : ''}::${normalizeKey(name)}`;
          if (existingKeys.has(dedupeKey)) throw new Error(`Subject "${name}" already exists${className ? ` for class "${className}"` : ''}`);

          await Subject.create({
            schoolId,
            campusId: campusId || null,
            classId: classId || undefined,
            name,
            code: String(row.code || '').trim() || undefined,
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
