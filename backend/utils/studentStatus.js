const EXITED_STUDENT_STATUSES = ['Leaving', 'Left', 'Expelled', 'leaving', 'left', 'expelled'];

const isExitedStudentStatus = (status) =>
  EXITED_STUDENT_STATUSES.includes(String(status || '').trim());

// Mongo filter fragment that scopes a StudentUser query to currently-enrolled
// students only (excludes archived and exited/Leaving-Left-Expelled records).
const ACTIVE_STUDENT_FILTER = {
  isArchived: { $ne: true },
  status: { $nin: EXITED_STUDENT_STATUSES },
};

// Same "currently active" concept, applied to ParentUser (whose isArchived
// is derived from its children's status — see utils/parentArchiveSync.js).
const ACTIVE_PARENT_FILTER = { isArchived: { $ne: true } };

// TeacherUser uses isArchived (off-boarded teachers); StaffUser and Admin use
// a status enum. Excludes those so platform-wide usage totals only count
// currently-employed/active accounts, not off-boarded ones.
const ACTIVE_TEACHER_FILTER = { isArchived: { $ne: true } };
const ACTIVE_STAFF_FILTER = { status: { $ne: 'Inactive' } };
const ACTIVE_ADMIN_FILTER = { status: { $ne: 'inactive' } };

module.exports = {
  EXITED_STUDENT_STATUSES,
  isExitedStudentStatus,
  ACTIVE_STUDENT_FILTER,
  ACTIVE_PARENT_FILTER,
  ACTIVE_TEACHER_FILTER,
  ACTIVE_STAFF_FILTER,
  ACTIVE_ADMIN_FILTER,
};
