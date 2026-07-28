const {
  getNumber,
  increment,
} = require('./redisClient');

const normalizePart = (value, fallback = 'none') => {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
};

const buildStudentSubjectsScope = ({
  organizationId,
  schoolId,
  campusId,
  classId,
  sectionId,
}) => ({
  organizationId: normalizePart(organizationId, 'school-only'),
  schoolId: normalizePart(schoolId),
  campusId: normalizePart(campusId, 'all-campuses'),
  classId: normalizePart(classId),
  sectionId: normalizePart(sectionId),
});

const scopeParts = (scope) => [
  scope.organizationId,
  scope.schoolId,
  scope.campusId,
  scope.classId,
  scope.sectionId,
].map(normalizePart);

const buildStudentSubjectsVersionKey = (scopeInput) => (
  `cache:v1:student-subjects:version:${scopeParts(buildStudentSubjectsScope(scopeInput)).join(':')}`
);

const getStudentSubjectsCacheKey = async ({
  studentId,
  ...scopeInput
}) => {
  const scope = buildStudentSubjectsScope(scopeInput);
  const version = await getNumber(buildStudentSubjectsVersionKey(scope));

  return [
    'cache:v1',
    'student-subjects',
    ...scopeParts(scope),
    `student:${normalizePart(studentId)}`,
    `version:${version}`,
  ].join(':');
};

const invalidateStudentSubjectsCache = async (scopeInput) => {
  const scope = buildStudentSubjectsScope(scopeInput);
  await increment(buildStudentSubjectsVersionKey(scope));
};

module.exports = {
  buildStudentSubjectsScope,
  buildStudentSubjectsVersionKey,
  getStudentSubjectsCacheKey,
  invalidateStudentSubjectsCache,
};
