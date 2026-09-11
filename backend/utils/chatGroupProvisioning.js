const ChatThread = require('../models/ChatThread');
const ChatMessage = require('../models/ChatMessage');
const TeacherUser = require('../models/TeacherUser');
const StudentUser = require('../models/StudentUser');
const Subject = require('../models/Subject');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const TeacherAllocation = require('../models/TeacherAllocation');
const Timetable = require('../models/Timetable');
const GROUP_KEY_ROUTINE_PREFIX = 'routine-subject';
const GROUP_KEY_CLASS_TEACHER_PREFIX = 'class-teacher';

const buildCampusOr = (campusId) => (
  campusId
    ? [{ campusId }, { campusId: null }, { campusId: { $exists: false } }]
    : null
);

const addParticipant = (map, userId, userType, name) => {
  if (!userId) return;
  const key = String(userId);
  if (!key || map.has(key)) return;
  map.set(key, { userId, userType, name: String(name || '').trim() });
};

const yy = () => String(new Date().getFullYear()).slice(-2);

// Runs `fn` over `items` with at most `limit` in flight at once. The sync
// loops below used to await one allocation/timetable-combo at a time — each
// iteration is several sequential DB round trips, so for a school with
// hundreds of allocations that serialized into 40-70+ seconds per sync and,
// worse, blocked the shared Mongo connection pool for every other request in
// the app for that whole window. Iterations are independent (distinct group
// keys), so running them concurrently is safe.
const mapWithConcurrency = async (items, limit, fn) => {
  const results = new Array(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (true) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

// Batch-fetches every piece of reference data the sync loops below need, in a
// handful of $in queries instead of ~5 queries per allocation/timetable-combo.
// With hundreds of combos and real network latency to the DB in the
// hundreds-of-ms range (nothing app code can change), per-combo queries is
// what turned a sync into a 40-70+ second operation regardless of how much
// the loop itself is parallelized — cutting query *count* is what actually
// fixes it.
const buildProvisioningPrefetch = async ({ schoolId, campusId, combos }) => {
  // schoolId/campusId are only present for the per-school hot path
  // (chatRoutes.js self-heal). syncAllocationGroupThreads() is also called
  // with no args at server boot (config/database.js) to resync every school
  // at once — schoolId is null there, meaning "no filter", not "match null".
  const schoolCondition = schoolId ? { schoolId } : {};
  const campusCondition = buildCampusOr(campusId);
  const teacherIds = new Set();
  const classIds = new Set();
  const sectionIds = new Set();
  const subjectIds = new Set();
  combos.forEach((c) => {
    (c.teacherIds || []).forEach((id) => id && teacherIds.add(String(id)));
    if (c.classId) classIds.add(String(c.classId));
    if (c.sectionId) sectionIds.add(String(c.sectionId));
    if (c.subjectId) subjectIds.add(String(c.subjectId));
  });

  const [teachers, classes, sections, subjects, students, existingThreads] = await Promise.all([
    teacherIds.size
      ? TeacherUser.find({ _id: { $in: [...teacherIds] }, ...schoolCondition, ...(campusCondition ? { $or: campusCondition } : {}) })
          .select('_id name employeeCode').lean()
      : [],
    classIds.size
      ? ClassModel.find({ _id: { $in: [...classIds] }, ...schoolCondition, ...(campusCondition ? { $or: campusCondition } : {}) })
          .select('_id name').lean()
      : [],
    sectionIds.size
      ? Section.find({ _id: { $in: [...sectionIds] }, ...schoolCondition, ...(campusCondition ? { $or: campusCondition } : {}) })
          .select('_id name classId').lean()
      : [],
    subjectIds.size
      ? Subject.find({ _id: { $in: [...subjectIds] }, ...schoolCondition, ...(campusCondition ? { $or: campusCondition } : {}) })
          .select('_id name code').lean()
      : [],
    StudentUser.find({ ...schoolCondition, ...(campusCondition ? { $or: campusCondition } : {}) })
      .select('_id name username studentCode grade section schoolId').lean(),
    ChatThread.find({
      ...schoolCondition,
      ...(campusId !== null && campusId !== undefined ? { campusId } : {}),
    }).select('_id groupKey participants unreadCounts').lean(),
  ]);

  // Keyed by schoolId too — grade/section are free-text values a global
  // (all-schools) resync could otherwise collide across different schools.
  const studentsByGradeSection = new Map();
  students.forEach((s) => {
    const key = `${String(s.schoolId || '')}::${String(s.grade || '')}::${String(s.section || '')}`;
    if (!studentsByGradeSection.has(key)) studentsByGradeSection.set(key, []);
    studentsByGradeSection.get(key).push(s);
  });

  return {
    teachersById: new Map(teachers.map((t) => [String(t._id), t])),
    classesById: new Map(classes.map((c) => [String(c._id), c])),
    sectionsById: new Map(sections.map((s) => [String(s._id), s])),
    subjectsById: new Map(subjects.map((s) => [String(s._id), s])),
    studentsByGradeSection,
    threadsByGroupKey: new Map(existingThreads.filter((t) => t.groupKey).map((t) => [t.groupKey, t])),
    existingThreads,
  };
};

const buildAllocationGroupKey = ({
  schoolId,
  campusId,
  subjectId,
  classId,
  sectionId,
  isClassTeacher = false,
}) => {
  if (!schoolId || !classId || !sectionId) return null;
  const scope = String(campusId || 'global');
  if (isClassTeacher) {
    return `${GROUP_KEY_CLASS_TEACHER_PREFIX}:${String(schoolId)}:${scope}:${String(classId)}:${String(sectionId)}`;
  }
  if (!subjectId) return null;
  return `${GROUP_KEY_ROUTINE_PREFIX}:${String(schoolId)}:${scope}:${String(classId)}:${String(sectionId)}:${String(subjectId)}`;
};

const deleteThreadByGroupKey = async ({ schoolId, campusId, groupKey }) => {
  if (!schoolId || !groupKey) return false;
  const thread = await ChatThread.findOne({
    schoolId,
    campusId,
    groupKey,
  }).select('_id').lean();
  if (!thread?._id) return false;
  await ChatMessage.deleteMany({ threadId: thread._id });
  await ChatThread.deleteOne({ _id: thread._id });
  return true;
};

const ensureAllocationGroupThread = async ({
  schoolId,
  campusId,
  teacherId,
  teacherIds = null,
  subjectId,
  classId,
  sectionId,
  isClassTeacher = false,
  // Optional batch-fetched reference data (see buildProvisioningPrefetch).
  // When provided, this call makes zero read round trips — only the
  // create/update write(s) at the end. Used by the sync* functions below,
  // which call this once per allocation/timetable-combo; per-call reads for
  // hundreds of combos is what made a full sync take 40-70+ seconds.
  // Callers that provision a single allocation (teacherAllocationRoutes.js)
  // omit this and keep the original per-call query behavior.
  prefetch = null,
}) => {
  if (!schoolId || !classId || !sectionId) return null;
  if (!isClassTeacher && !subjectId) return null;

  const campusCondition = buildCampusOr(campusId);
  const normalizedTeacherIds = [
    ...new Set(
      (Array.isArray(teacherIds) ? teacherIds : [teacherId])
        .filter(Boolean)
        .map((id) => String(id))
    ),
  ];
  if (normalizedTeacherIds.length === 0) return null;

  let teacher;
  let classDoc;
  let sectionDoc;
  let subject = null;
  if (prefetch) {
    teacher = normalizedTeacherIds
      .map((id) => prefetch.teachersById.get(id))
      .filter(Boolean);
    classDoc = prefetch.classesById.get(String(classId)) || null;
    sectionDoc = prefetch.sectionsById.get(String(sectionId)) || null;
    subject = !isClassTeacher && subjectId ? (prefetch.subjectsById.get(String(subjectId)) || null) : null;
  } else {
    const queries = [
      TeacherUser.find({
        _id: { $in: normalizedTeacherIds },
        schoolId,
        ...(campusCondition ? { $or: campusCondition } : {}),
      }).select('_id name employeeCode').lean(),
      ClassModel.findOne({
        _id: classId,
        schoolId,
        ...(campusCondition ? { $or: campusCondition } : {}),
      }).select('_id name').lean(),
      Section.findOne({
        _id: sectionId,
        schoolId,
        ...(campusCondition ? { $or: campusCondition } : {}),
      }).select('_id name classId').lean(),
    ];
    if (!isClassTeacher && subjectId) {
      queries.push(
        Subject.findOne({
          _id: subjectId,
          schoolId,
          ...(campusCondition ? { $or: campusCondition } : {}),
        }).select('_id name code').lean()
      );
    }
    [teacher, classDoc, sectionDoc, subject = null] = await Promise.all(queries);
  }

  if (!teacher || teacher.length === 0 || !classDoc || !sectionDoc) return null;
  if (!isClassTeacher && !subject) return null;

  const className = String(classDoc.name || '').trim();
  const sectionName = String(sectionDoc.name || '').trim();
  const subjectName = String(subject?.name || subject?.code || '').trim();
  if (!className || !sectionName || (!isClassTeacher && !subjectName)) return null;

  const groupYear = yy();
  const groupName = isClassTeacher
    ? `Class Teacher ${className}-${sectionName} ${groupYear}`
    : `${subjectName} ${className}-${sectionName} ${groupYear}`;
  const groupKey = buildAllocationGroupKey({
    schoolId,
    campusId,
    subjectId,
    classId,
    sectionId,
    isClassTeacher,
  });
  if (!groupKey) return null;

  let students;
  if (prefetch) {
    students = prefetch.studentsByGradeSection.get(`${String(schoolId)}::${className}::${sectionName}`) || [];
  } else {
    const studentFilter = {
      schoolId,
      grade: className,
      section: sectionName,
    };
    if (campusCondition) studentFilter.$or = campusCondition;
    students = await StudentUser.find(studentFilter)
      .select('_id name username studentCode')
      .lean();
  }

  const participantsMap = new Map();
  const teacherNameById = new Map();
  teacher.forEach((t) => {
    const tId = String(t._id);
    const tName = t.name || t.employeeCode || 'Teacher';
    teacherNameById.set(tId, tName);
    addParticipant(participantsMap, t._id, 'teacher', tName);
  });
  students.forEach((student) => {
    addParticipant(participantsMap, student._id, 'student', student.name || student.username || student.studentCode || 'Student');
  });

  let thread = prefetch
    ? (prefetch.threadsByGroupKey.get(groupKey) || null)
    : await ChatThread.findOne({
        schoolId,
        campusId,
        groupKey,
      }).lean();
  const participants = Array.from(participantsMap.values());
  const existingTeacherNameById = new Map(
    (thread?.participants || [])
      .filter((p) => p.userType === 'teacher' && p.userId)
      .map((p) => [String(p.userId), String(p.name || 'Teacher')])
  );
  const previousTeacherIds = new Set(existingTeacherNameById.keys());
  const currentTeacherIds = new Set(normalizedTeacherIds);

  if (participants.length < 2) {
    if (thread?._id) {
      await ChatMessage.deleteMany({ threadId: thread._id });
      await ChatThread.deleteOne({ _id: thread._id });
    }
    return null;
  }

  const existingUnreadMap = new Map(
    (thread?.unreadCounts || []).map((u) => [String(u.userId), Number(u.count || 0)])
  );
  const unreadCounts = participants.map((p) => ({
    userId: p.userId,
    count: existingUnreadMap.get(String(p.userId)) || 0,
  }));

  if (!thread) {
    thread = await ChatThread.create({
      schoolId,
      campusId,
      threadType: 'group',
      groupName,
      groupKey,
      groupMeta: {
        teacherId: normalizedTeacherIds[0] || null,
        subjectId: subjectId || null,
        classId,
        sectionId,
        year: groupYear,
        isClassTeacher: Boolean(isClassTeacher),
      },
      participants,
      unreadCounts,
    });

    const now = new Date();
    const systemText = `System added you to ${groupName}`;
    await ChatMessage.create({
      threadId: thread._id,
      senderId: teacher[0]._id,
      senderType: 'system',
      senderName: 'System',
      text: systemText,
      schoolId,
      campusId,
      seenBy: [],
    });

    await ChatThread.updateOne(
      { _id: thread._id },
      {
        $set: {
          lastMessage: systemText,
          lastMessageAt: now,
          lastSenderId: teacher[0]._id,
        },
      }
    );
  } else {
    const updateSet = {
      groupName,
      threadType: 'group',
      participants,
      unreadCounts,
      groupMeta: {
        teacherId: normalizedTeacherIds[0] || null,
        subjectId: subjectId || null,
        classId,
        sectionId,
        year: groupYear,
        isClassTeacher: Boolean(isClassTeacher),
      },
    };
    await ChatThread.updateOne({ _id: thread._id }, { $set: updateSet });

    const removedTeacherIds = [...previousTeacherIds].filter((id) => !currentTeacherIds.has(id));
    const addedTeacherIds = [...currentTeacherIds].filter((id) => !previousTeacherIds.has(id));
    const systemEvents = [
      ...removedTeacherIds.map((id) => `System removed ${existingTeacherNameById.get(id) || 'Teacher'}`),
      ...addedTeacherIds.map((id) => `System added ${teacherNameById.get(id) || 'Teacher'}`),
    ];
    for (const text of systemEvents) {
      await ChatMessage.create({
        threadId: thread._id,
        senderId: teacher[0]._id,
        senderType: 'system',
        senderName: 'System',
        text,
        schoolId,
        campusId,
        seenBy: [],
      });
      await ChatThread.updateOne(
        { _id: thread._id },
        {
          $set: {
            lastMessage: text,
            lastMessageAt: new Date(),
            lastSenderId: teacher[0]._id,
          },
        }
      );
    }
  }

  return thread?._id || null;
};

const removeAllocationGroupThread = async ({
  schoolId,
  campusId,
  subjectId,
  classId,
  sectionId,
  isClassTeacher = false,
}) => {
  const groupKey = buildAllocationGroupKey({
    schoolId,
    campusId,
    subjectId,
    classId,
    sectionId,
    isClassTeacher,
  });
  if (!groupKey) return false;
  return deleteThreadByGroupKey({ schoolId, campusId, groupKey });
};

const syncAllocationGroupThreads = async ({ schoolId = null, campusId = null } = {}) => {
  const filter = {};
  if (schoolId) filter.schoolId = schoolId;
  if (campusId !== null && campusId !== undefined) filter.campusId = campusId;

  const allocations = await TeacherAllocation.find(filter)
    .select('schoolId campusId teacherId subjectId classId sectionId isClassTeacher')
    .lean();

  const validGroupKeys = new Set();
  const classTeacherAllocations = allocations.filter((allocation) => Boolean(allocation.isClassTeacher));
  const prefetch = await buildProvisioningPrefetch({
    schoolId,
    campusId,
    combos: classTeacherAllocations.map((a) => ({
      teacherIds: [a.teacherId],
      classId: a.classId,
      sectionId: a.sectionId,
      subjectId: null,
    })),
  });
  const threadIds = await mapWithConcurrency(classTeacherAllocations, 8, async (allocation) => {
    const isClassTeacher = true;
    const groupKey = buildAllocationGroupKey({
      schoolId: allocation.schoolId,
      campusId: allocation.campusId || null,
      subjectId: allocation.subjectId,
      classId: allocation.classId,
      sectionId: allocation.sectionId,
      isClassTeacher,
    });
    if (groupKey) validGroupKeys.add(groupKey);

    return ensureAllocationGroupThread({
      schoolId: allocation.schoolId,
      campusId: allocation.campusId || null,
      teacherId: allocation.teacherId,
      teacherIds: [allocation.teacherId],
      subjectId: allocation.subjectId,
      classId: allocation.classId,
      sectionId: allocation.sectionId,
      isClassTeacher,
      prefetch,
    });
  });
  const createdOrUpdated = threadIds.filter(Boolean).length;

  const staleThreadIds = prefetch.existingThreads
    .filter((thread) => String(thread.groupKey || '').startsWith(`${GROUP_KEY_CLASS_TEACHER_PREFIX}:`))
    .filter((thread) => !validGroupKeys.has(String(thread.groupKey || '')))
    .map((thread) => thread._id);

  if (staleThreadIds.length > 0) {
    await ChatMessage.deleteMany({ threadId: { $in: staleThreadIds } });
    await ChatThread.deleteMany({ _id: { $in: staleThreadIds } });
  }

  return { scanned: allocations.length, createdOrUpdated, removedStale: staleThreadIds.length };
};

const syncTimetableGroupThreads = async ({ schoolId = null, campusId = null } = {}) => {
  const timetableFilter = {};
  if (schoolId) timetableFilter.schoolId = schoolId;
  if (campusId !== null && campusId !== undefined) timetableFilter.campusId = campusId;

  const timetables = await Timetable.find(timetableFilter)
    .select('schoolId campusId classId sectionId entries')
    .lean();

  const combos = new Map();
  timetables.forEach((tt) => {
    const classId = tt.classId ? String(tt.classId) : '';
    const sectionId = tt.sectionId ? String(tt.sectionId) : '';
    if (!classId || !sectionId) return;
    (tt.entries || []).forEach((entry) => {
      const subjectId = entry?.subjectId ? String(entry.subjectId) : '';
      const teacherId = entry?.teacherId ? String(entry.teacherId) : '';
      if (!subjectId || !teacherId) return;
      const key = `${String(tt.schoolId)}::${String(tt.campusId || 'global')}::${classId}::${sectionId}::${subjectId}`;
      if (!combos.has(key)) {
        combos.set(key, {
          schoolId: tt.schoolId,
          campusId: tt.campusId || null,
          classId,
          sectionId,
          subjectId,
          teacherIds: new Set(),
        });
      }
      combos.get(key).teacherIds.add(teacherId);
    });
  });

  const validGroupKeys = new Set();
  const comboList = [...combos.values()].map((combo) => ({
    combo,
    groupKey: buildAllocationGroupKey({
      schoolId: combo.schoolId,
      campusId: combo.campusId,
      subjectId: combo.subjectId,
      classId: combo.classId,
      sectionId: combo.sectionId,
      isClassTeacher: false,
    }),
  })).filter(({ groupKey }) => Boolean(groupKey));
  comboList.forEach(({ groupKey }) => validGroupKeys.add(groupKey));

  const prefetch = await buildProvisioningPrefetch({
    schoolId,
    campusId,
    combos: comboList.map(({ combo }) => ({
      teacherIds: [...combo.teacherIds],
      classId: combo.classId,
      sectionId: combo.sectionId,
      subjectId: combo.subjectId,
    })),
  });

  const threadIds = await mapWithConcurrency(comboList, 8, async ({ combo }) => {
    const teacherIds = [...combo.teacherIds];
    return ensureAllocationGroupThread({
      schoolId: combo.schoolId,
      campusId: combo.campusId,
      teacherIds,
      teacherId: teacherIds[0] || null,
      subjectId: combo.subjectId,
      classId: combo.classId,
      sectionId: combo.sectionId,
      isClassTeacher: false,
      prefetch,
    });
  });
  const createdOrUpdated = threadIds.filter(Boolean).length;

  const staleThreadIds = prefetch.existingThreads
    .filter((thread) => String(thread.groupKey || '').startsWith(`${GROUP_KEY_ROUTINE_PREFIX}:`))
    .filter((thread) => !validGroupKeys.has(String(thread.groupKey || '')))
    .map((thread) => thread._id);

  if (staleThreadIds.length > 0) {
    await ChatMessage.deleteMany({ threadId: { $in: staleThreadIds } });
    await ChatThread.deleteMany({ _id: { $in: staleThreadIds } });
  }

  return { scanned: timetables.length, createdOrUpdated, removedStale: staleThreadIds.length };
};

module.exports = { ensureAllocationGroupThread, removeAllocationGroupThread, syncAllocationGroupThreads, syncTimetableGroupThreads };
