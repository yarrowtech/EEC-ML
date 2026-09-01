const ParentUser = require('../models/ParentUser');
const StudentUser = require('../models/StudentUser');

/**
 * Resolve the students linked to a parent account.
 *
 * A parent may be linked to children in two ways:
 *   1. `childrenIds` — an array of StudentUser ObjectIds (preferred, authoritative)
 *   2. `children`    — a legacy array of student name strings
 *
 * Historically only some parent routes handled the name fallback, which meant
 * name-linked parents got empty dashboards on routes that only checked
 * `childrenIds`. This helper is the single source of truth for every parent
 * route so the two paths can never drift apart again.
 *
 * @param {Object} opts
 * @param {string|Object} opts.parentId  ParentUser _id (or the lean parent doc)
 * @param {string} [opts.schoolId]       School scope (falls back to the parent's own schoolId)
 * @param {string} [opts.campusId]       Optional campus scope
 * @param {string} [opts.select]         Mongoose field projection for the returned student docs
 * @returns {Promise<{ parent: Object|null, students: Object[], childIds: string[] }>}
 */
const resolveParentChildren = async ({ parentId, schoolId, campusId, select } = {}) => {
  const parent =
    parentId && typeof parentId === 'object' && parentId._id
      ? parentId
      : await ParentUser.findById(parentId)
          .select('name email mobile schoolId campusId childrenIds children')
          .lean();

  if (!parent) return { parent: null, students: [], childIds: [] };

  const effectiveSchoolId = schoolId || parent.schoolId || null;
  const scope = { schoolId: effectiveSchoolId, isArchived: { $ne: true } };
  if (campusId || parent.campusId) scope.campusId = campusId || parent.campusId;

  const projection = select || 'name grade section roll studentCode username admissionNumber';

  let students = [];
  if (Array.isArray(parent.childrenIds) && parent.childrenIds.length > 0) {
    students = await StudentUser.find({ ...scope, _id: { $in: parent.childrenIds } })
      .select(projection)
      .lean();
  }

  if (students.length === 0 && Array.isArray(parent.children) && parent.children.length > 0) {
    const names = parent.children.map((name) => String(name || '').trim()).filter(Boolean);
    if (names.length > 0) {
      students = await StudentUser.find({ ...scope, name: { $in: names } })
        .select(projection)
        .lean();
    }
  }

  return {
    parent,
    students,
    childIds: students.map((student) => String(student._id)),
  };
};

/**
 * True when `studentId` belongs to the resolved child id list.
 */
const parentOwnsStudent = (childIds, studentId) =>
  Array.isArray(childIds) && childIds.some((id) => String(id) === String(studentId));

module.exports = { resolveParentChildren, parentOwnsStudent };
