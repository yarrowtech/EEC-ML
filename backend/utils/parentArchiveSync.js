const ParentUser = require('../models/ParentUser');
const StudentUser = require('../models/StudentUser');
const { ACTIVE_STUDENT_FILTER } = require('./studentStatus');

// Re-derives ParentUser.isArchived for every parent linked (via childrenIds)
// to any of the given student ids: archived once none of their linked
// children are currently active. Call this after any write that changes a
// StudentUser's isArchived/status fields (archive, unarchive, mark-leaving,
// mark-left, restore, bulk variants, data erasure).
const syncParentArchiveStatusForStudents = async (studentIds = []) => {
  const ids = (Array.isArray(studentIds) ? studentIds : [studentIds]).filter(Boolean);
  if (!ids.length) return;

  const parents = await ParentUser.find({ childrenIds: { $in: ids } }).select('childrenIds isArchived').lean();
  if (!parents.length) return;

  const allChildIds = [...new Set(parents.flatMap((p) => (p.childrenIds || []).map(String)))];
  const activeChildIds = new Set(
    (await StudentUser.find({ _id: { $in: allChildIds }, ...ACTIVE_STUDENT_FILTER }).select('_id').lean())
      .map((s) => String(s._id))
  );

  const now = new Date();
  const toArchive = [];
  const toRestore = [];
  parents.forEach((parent) => {
    const hasActiveChild = (parent.childrenIds || []).some((childId) => activeChildIds.has(String(childId)));
    const shouldBeArchived = !hasActiveChild;
    if (shouldBeArchived && !parent.isArchived) toArchive.push(parent._id);
    else if (!shouldBeArchived && parent.isArchived) toRestore.push(parent._id);
  });

  await Promise.all([
    toArchive.length
      ? ParentUser.updateMany({ _id: { $in: toArchive } }, { $set: { isArchived: true, archivedAt: now } })
      : null,
    toRestore.length
      ? ParentUser.updateMany({ _id: { $in: toRestore } }, { $set: { isArchived: false, archivedAt: null } })
      : null,
  ]);
};

module.exports = { syncParentArchiveStatusForStudents };
