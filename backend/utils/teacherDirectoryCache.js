// Shared in-memory cache for the teacher directory list (GET /get-teachers
// and GET /get-principals), mirroring the students/parents list cache
// pattern already used in routes/adminUserManagement.js. Kept in its own
// module (rather than inline there) so routes/teacherRoute.js — where a new
// teacher is actually created — can invalidate it too, without the two
// route files having to require each other.
const TEACHER_LIST_TTL_MS = 15 * 1000;

const teachersListCache = new Map(); // key -> { data, expires }
const principalsListCache = new Map();

const teacherDirectoryCacheKey = (req) =>
  `${req.schoolId || 'x'}:${req.campusId || 'x'}:${req.isSuperAdmin ? 'super' : 'admin'}`;

const invalidateTeacherDirectoryCaches = () => {
  teachersListCache.clear();
  principalsListCache.clear();
};

module.exports = {
  TEACHER_LIST_TTL_MS,
  teachersListCache,
  principalsListCache,
  teacherDirectoryCacheKey,
  invalidateTeacherDirectoryCaches,
};
