const TeacherAllocation = require('../models/TeacherAllocation');
const Timetable = require('../models/Timetable');

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const normalizeClassName = (value) => normalizeText(value).replace(/^class\s+/, '').trim();

const buildCampusFilter = (campusId) => (
  campusId
    ? { $or: [{ campusId }, { campusId: null }, { campusId: { $exists: false } }] }
    : {}
);

const mergeScope = (scopeMap, { className, sectionName, subjectName = '', isClassTeacher = false }) => {
  const normalizedClass = normalizeClassName(className);
  const normalizedSection = normalizeText(sectionName);
  const normalizedSubject = normalizeText(subjectName);
  if (!normalizedClass) return;

  const key = `${normalizedClass}::${normalizedSection}`;
  const current = scopeMap.get(key) || {
    className: String(className || '').trim(),
    sectionName: String(sectionName || '').trim(),
    normalizedClass,
    normalizedSection,
    subjects: [],
    isClassTeacher: false,
  };
  if (normalizedSubject && !current.subjects.some((item) => normalizeText(item) === normalizedSubject)) {
    current.subjects.push(String(subjectName).trim());
  }
  current.isClassTeacher = current.isClassTeacher || Boolean(isClassTeacher);
  scopeMap.set(key, current);
};

const buildTeacherAllocationScope = async ({ schoolId, campusId = null, teacherId }) => {
  if (!schoolId || !teacherId) return [];

  const scopeMap = new Map();
  const allocations = await TeacherAllocation.find({
    schoolId,
    teacherId,
    ...buildCampusFilter(campusId),
  })
    .populate('classId', 'name academicYearId')
    .populate('sectionId', 'name')
    .populate('subjectId', 'name')
    .lean();

  allocations.forEach((allocation) => {
    mergeScope(scopeMap, {
      className: allocation?.classId?.name,
      sectionName: allocation?.sectionId?.name,
      subjectName: allocation?.subjectId?.name,
      isClassTeacher: allocation?.isClassTeacher || !allocation?.subjectId,
    });
  });

  // Legacy schools may only have timetable assignments. Use them only when no
  // explicit allocation exists, matching the dashboard allocation fallback.
  if (!scopeMap.size) {
    const timetables = await Timetable.find({
      schoolId,
      'entries.teacherId': teacherId,
      ...buildCampusFilter(campusId),
    })
      .populate('classId', 'name academicYearId')
      .populate('sectionId', 'name')
      .populate('entries.subjectId', 'name')
      .lean();

    timetables.forEach((timetable) => {
      (timetable.entries || []).forEach((entry) => {
        if (String(entry?.teacherId || '') !== String(teacherId)) return;
        mergeScope(scopeMap, {
          className: timetable?.classId?.name,
          sectionName: timetable?.sectionId?.name,
          subjectName: entry?.subjectId?.name,
          isClassTeacher: false,
        });
      });
    });
  }

  return [...scopeMap.values()];
};

const studentIsWithinTeacherScope = (student, scope = []) => {
  const studentClass = normalizeClassName(student?.grade || student?.className);
  const studentSection = normalizeText(student?.section || student?.sectionName);
  return scope.some((item) => (
    studentClass === item.normalizedClass
    && (!item.normalizedSection || studentSection === item.normalizedSection)
  ));
};

const scopeAllowsRequest = (scope = [], { grade = '', section = '', subject = '' } = {}) => {
  const requestedClass = normalizeClassName(grade);
  const requestedSection = normalizeText(section);
  const requestedSubject = normalizeText(subject);

  return scope.some((item) => {
    if (requestedClass && requestedClass !== item.normalizedClass) return false;
    if (requestedSection && requestedSection !== item.normalizedSection) return false;
    if (!requestedSubject || item.isClassTeacher) return true;
    return item.subjects.some((itemSubject) => normalizeText(itemSubject) === requestedSubject);
  });
};

const subjectIsAllowedForStudent = (student, subject, scope = []) => {
  const requestedSubject = normalizeText(subject);
  if (!requestedSubject) return true;
  const studentClass = normalizeClassName(student?.grade || student?.className);
  const studentSection = normalizeText(student?.section || student?.sectionName);
  return scope.some((item) => {
    if (studentClass !== item.normalizedClass) return false;
    if (item.normalizedSection && studentSection !== item.normalizedSection) return false;
    return item.isClassTeacher || item.subjects.some((value) => normalizeText(value) === requestedSubject);
  });
};

const allowedSubjectsForStudent = (student, scope = []) => {
  const studentClass = normalizeClassName(student?.grade || student?.className);
  const studentSection = normalizeText(student?.section || student?.sectionName);
  const matching = scope.filter((item) => (
    studentClass === item.normalizedClass
    && (!item.normalizedSection || studentSection === item.normalizedSection)
  ));
  if (matching.some((item) => item.isClassTeacher)) return null;
  return new Set(matching.flatMap((item) => item.subjects.map(normalizeText)).filter(Boolean));
};

module.exports = {
  allowedSubjectsForStudent,
  buildTeacherAllocationScope,
  normalizeClassName,
  normalizeText,
  scopeAllowsRequest,
  studentIsWithinTeacherScope,
  subjectIsAllowedForStudent,
};
