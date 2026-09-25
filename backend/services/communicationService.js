/**
 * EEC communication engine.
 *
 *   ADMIN ACTION → EVENT → TARGETING ENGINE → NOTICE and/or NOTIFICATION → role views
 *
 * Both notices and notifications live in the existing `Notification`
 * collection, separated by `kind`:
 *   - kind 'notice'       → official, persistent communication (Notices pages)
 *   - kind 'notification' → short, actionable, targeted alert (bell)
 *
 * This service owns:
 *   1. resolveAudience(): who is affected, derived from data (class/section →
 *      students → linked parents; duties → that teacher; …) — admins never
 *      have to hand-pick recipients.
 *   2. notify(): role-specific notification copies that reference the source
 *      entity (entityType/entityId) instead of copying large data.
 *   3. publishNotice(): an official notice, optionally with a short
 *      NOTICE_PUBLISHED notification.
 *   4. Idempotency: every copy has a dedupeKey = event + entity + recipient
 *      scope + data fingerprint, so repeating an event with unchanged data is
 *      a no-op, and an "updated" notification is only sent when data changed.
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const StudentUser = require('../models/StudentUser');
const ParentUser = require('../models/ParentUser');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const { ACTIVE_STUDENT_FILTER } = require('../utils/studentStatus');

// ── Event catalogue ─────────────────────────────────────────────────────────
const EVENTS = Object.freeze({
  EXAM_CREATED: 'EXAM_CREATED',
  EXAM_UPDATED: 'EXAM_UPDATED',
  EXAM_CANCELLED: 'EXAM_CANCELLED',
  EXAM_ROUTINE_PUBLISHED: 'EXAM_ROUTINE_PUBLISHED',
  EXAM_ROUTINE_UPDATED: 'EXAM_ROUTINE_UPDATED',
  EXAM_DUTY_ASSIGNED: 'EXAM_DUTY_ASSIGNED',
  EXAM_DUTY_CHANGED: 'EXAM_DUTY_CHANGED',
  RESULT_PUBLISHED: 'RESULT_PUBLISHED',
  NOTICE_PUBLISHED: 'NOTICE_PUBLISHED',
  FEE_CREATED: 'FEE_CREATED',
  FEE_PAYMENT_RECEIVED: 'FEE_PAYMENT_RECEIVED',
  FEE_DUE: 'FEE_DUE',
  FEE_REMINDER: 'FEE_REMINDER',
  HOLIDAY_CREATED: 'HOLIDAY_CREATED',
  HOLIDAY_UPDATED: 'HOLIDAY_UPDATED',
  HOLIDAY_CANCELLED: 'HOLIDAY_CANCELLED',
  STUDENT_PROMOTED: 'STUDENT_PROMOTED',
  LEAVE_APPROVED: 'LEAVE_APPROVED',
  LEAVE_REJECTED: 'LEAVE_REJECTED',
  ASSIGNMENT_CREATED: 'ASSIGNMENT_CREATED',
  FEEDBACK_WINDOW_OPENED: 'FEEDBACK_WINDOW_OPENED',
  FEEDBACK_WINDOW_UPDATED: 'FEEDBACK_WINDOW_UPDATED',
  FEEDBACK_WINDOW_CLOSED: 'FEEDBACK_WINDOW_CLOSED',
  FEEDBACK_WINDOW_REMINDER: 'FEEDBACK_WINDOW_REMINDER',
});

// Legacy `type` value per event (keeps existing icons/filters in the UI working).
const TYPE_FOR_EVENT = {
  EXAM_CREATED: 'exam', EXAM_UPDATED: 'exam', EXAM_CANCELLED: 'exam',
  EXAM_ROUTINE_PUBLISHED: 'exam', EXAM_ROUTINE_UPDATED: 'exam',
  EXAM_DUTY_ASSIGNED: 'exam', EXAM_DUTY_CHANGED: 'exam',
  RESULT_PUBLISHED: 'result',
  NOTICE_PUBLISHED: 'notice',
  FEE_CREATED: 'fee', FEE_PAYMENT_RECEIVED: 'fee', FEE_DUE: 'fee', FEE_REMINDER: 'fee',
  HOLIDAY_CREATED: 'announcement', HOLIDAY_UPDATED: 'announcement', HOLIDAY_CANCELLED: 'announcement',
  STUDENT_PROMOTED: 'general',
  LEAVE_APPROVED: 'general', LEAVE_REJECTED: 'general',
  ASSIGNMENT_CREATED: 'assignment',
};

const toId = (v) => (v && mongoose.isValidObjectId(String(v?._id || v)) ? new mongoose.Types.ObjectId(String(v?._id || v)) : null);
const uniqIds = (list) => [...new Map((list || []).map(toId).filter(Boolean).map((id) => [String(id), id])).values()];

// Stable short hash of the data that matters for an event — the same data
// yields the same fingerprint, so repeats are skipped.
const fingerprint = (data) => crypto
  .createHash('sha1')
  .update(JSON.stringify(data ?? ''))
  .digest('hex')
  .slice(0, 12);

// ── Targeting engine ────────────────────────────────────────────────────────
/**
 * target: {
 *   classSections?: [{ classId, sectionId? }]   // sectionId omitted → whole class
 *   classIds?: [classId]                        // whole classes (e.g. a 5–10 range)
 *   studentIds?: [studentId]
 *   teacherIds?: [teacherId]
 *   parentIds?:  [parentId]
 *   includeParents?: boolean (default true)     // resolve linked parents of students
 * }
 * Returns { students: [{_id,name,grade,section}], parentsByStudent: Map, parentIds, teacherIds }
 */
const resolveAudience = async ({ schoolId, campusId = null, target = {} }) => {
  const includeParents = target.includeParents !== false;
  const classSections = [
    ...(target.classSections || []),
    ...(target.classIds || []).map((classId) => ({ classId })),
  ].filter((cs) => cs?.classId);

  // Students keep class/section as names — translate ids → names first.
  const or = [];
  if (classSections.length) {
    const classIds = uniqIds(classSections.map((cs) => cs.classId));
    const sectionIds = uniqIds(classSections.map((cs) => cs.sectionId).filter(Boolean));
    const [classes, sections] = await Promise.all([
      ClassModel.find({ _id: { $in: classIds } }).select('name').lean(),
      sectionIds.length ? Section.find({ _id: { $in: sectionIds } }).select('name').lean() : [],
    ]);
    const className = new Map(classes.map((c) => [String(c._id), c.name]));
    const sectionName = new Map(sections.map((s) => [String(s._id), s.name]));
    classSections.forEach((cs) => {
      const cName = className.get(String(cs.classId?._id || cs.classId));
      if (!cName) return;
      const sName = cs.sectionId ? sectionName.get(String(cs.sectionId?._id || cs.sectionId)) : null;
      or.push({ grade: cName, ...(sName ? { section: sName } : {}) });
    });
  }
  const explicitStudents = uniqIds(target.studentIds);
  if (explicitStudents.length) or.push({ _id: { $in: explicitStudents } });

  const students = or.length
    ? await StudentUser.find({
      schoolId,
      ...(campusId ? { campusId } : {}),
      ...ACTIVE_STUDENT_FILTER,
      $or: or,
    }).select('_id name grade section').lean()
    : [];

  // Student → linked parents (ParentUser.childrenIds), used for parent copies.
  const parentsByStudent = new Map();
  if (includeParents && students.length) {
    const parents = await ParentUser.find({
      schoolId,
      childrenIds: { $in: students.map((s) => s._id) },
      isArchived: { $ne: true },
    }).select('_id childrenIds').lean();
    const studentSet = new Set(students.map((s) => String(s._id)));
    parents.forEach((p) => {
      (p.childrenIds || []).forEach((cid) => {
        const key = String(cid);
        if (!studentSet.has(key)) return;
        if (!parentsByStudent.has(key)) parentsByStudent.set(key, []);
        parentsByStudent.get(key).push(p._id);
      });
    });
  }

  const parentIds = uniqIds([
    ...[...parentsByStudent.values()].flat(),
    ...(target.parentIds || []),
  ]);
  return {
    students,
    parentsByStudent,
    parentIds,
    teacherIds: uniqIds(target.teacherIds),
  };
};

// ── Idempotent writer ───────────────────────────────────────────────────────
// Creates the notification unless one with the same dedupeKey exists. New docs
// go through Notification.create so the model's post-save hook fires the web
// push + realtime event; repeats are no-ops (returns the existing doc).
const createOnce = async (doc) => {
  const existing = await Notification.findOne({ dedupeKey: doc.dedupeKey }).select('_id').lean();
  if (existing) return { doc: existing, created: false };
  try {
    return { doc: await Notification.create(doc), created: true };
  } catch (err) {
    if (err?.code === 11000) return { doc: null, created: false }; // raced — already there
    throw err;
  }
};

const baseFields = ({ schoolId, campusId, eventType, entityType, entityId, priority, category, createdBy }) => ({
  schoolId,
  campusId: campusId || null,
  kind: 'notification',
  eventType,
  type: TYPE_FOR_EVENT[eventType] || 'general',
  typeLabel: String(eventType || '').toLowerCase(),
  priority: priority || 'medium',
  category: category || 'general',
  createdBy: createdBy || null,
  createdByType: 'admin',
  relatedEntity: entityId ? { entityType, entityId } : undefined,
});

/**
 * Send role-specific notifications for one event.
 *
 * opts: {
 *   schoolId, campusId, eventType, entityType, entityId, createdBy, priority, category,
 *   target,            // → resolveAudience()
 *   data,              // event data that matters; its fingerprint drives dedupe
 *   student?: (student) => ({ title, message }) | null   // one copy per class/section group
 *   parent?:  (student) => ({ title, message }) | null   // one copy per child → that child's parents
 *   teacher?: (teacherId) => ({ title, message }) | null // one copy per teacher
 *   admin?:   { title, message } | null                  // only for genuine admin-action items
 * }
 * Returns { created, skipped }.
 */
const notify = async (opts) => {
  const { schoolId, campusId = null, eventType, entityType, entityId, target = {}, data } = opts;
  if (!schoolId || !eventType) return { created: 0, skipped: 0 };
  const fp = fingerprint(data);
  const keyBase = `${eventType}:${schoolId}:${entityType || 'x'}:${entityId || 'x'}:${fp}`;
  const base = baseFields(opts);
  const audience = await resolveAudience({ schoolId, campusId, target });
  const jobs = [];

  // Students: one copy per class/section with that group's students as recipients.
  if (typeof opts.student === 'function' && audience.students.length) {
    const groups = new Map();
    audience.students.forEach((s) => {
      const key = `${s.grade}|${s.section}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(s);
    });
    groups.forEach((list, key) => {
      const content = opts.student(list[0], list);
      if (!content) return;
      jobs.push({
        ...base, ...content,
        audience: 'Student', targetRole: 'student',
        className: list[0].grade || '', sectionName: list[0].section || '',
        targetUserIds: list.map((s) => s._id),
        dedupeKey: `${keyBase}:student:${key}`,
      });
    });
  }

  // Parents: one copy per child (worded for that child) → that child's parents.
  if (typeof opts.parent === 'function') {
    audience.students.forEach((s) => {
      const parentIds = audience.parentsByStudent.get(String(s._id)) || [];
      if (!parentIds.length) return;
      const content = opts.parent(s);
      if (!content) return;
      jobs.push({
        ...base, ...content,
        audience: 'Parent', targetRole: 'parent',
        className: s.grade || '', sectionName: s.section || '',
        targetUserIds: parentIds,
        dedupeKey: `${keyBase}:parent:${s._id}`,
      });
    });
  }

  // Teachers: one copy per teacher (e.g. their own exam duty).
  if (typeof opts.teacher === 'function') {
    audience.teacherIds.forEach((tid) => {
      const content = opts.teacher(tid);
      if (!content) return;
      jobs.push({
        ...base, ...content,
        audience: 'Teacher', targetRole: 'teacher',
        targetUserIds: [tid],
        dedupeKey: `${keyBase}:teacher:${tid}`,
      });
    });
  }

  if (opts.admin) {
    jobs.push({ ...base, ...opts.admin, audience: 'Admin', targetRole: 'admin', dedupeKey: `${keyBase}:admin` });
  }

  let created = 0;
  let skipped = 0;
  for (const job of jobs) {
    // Sequential keeps push fan-out gentle and ordering deterministic.
    // eslint-disable-next-line no-await-in-loop
    const res = await createOnce(job);
    if (res.created) created += 1; else skipped += 1;
  }
  return { created, skipped };
};

/**
 * Publish an official NOTICE (persistent, shown on Notices pages), optionally
 * with a short NOTICE_PUBLISHED notification to the same audience.
 *
 * notice: { title, message, audience, classId, sectionId, category, priority,
 *           attachments, isPinned, expiresAt, createdBy, createdByName, … }
 */
const publishNotice = async ({ schoolId, campusId = null, notice, dedupeKey = null }) => {
  const doc = {
    ...notice,
    schoolId,
    campusId: campusId || null,
    kind: 'notice',
    eventType: EVENTS.NOTICE_PUBLISHED,
    targetRole: notice.targetRole || 'all',
    ...(dedupeKey ? { dedupeKey } : {}),
  };
  if (dedupeKey) return (await createOnce(doc)).doc;
  return Notification.create(doc);
};

/**
 * One school-wide notification (audience 'All') for events that concern
 * everyone equally (e.g. holidays) — no per-user fan-out, still idempotent.
 */
const broadcast = async ({ title, message, audience = 'All', extra = {}, ...opts }) => {
  if (!opts.schoolId || !opts.eventType) return { created: 0, skipped: 0 };
  const fp = fingerprint(opts.data);
  const res = await createOnce({
    ...baseFields(opts),
    title, message, audience, targetRole: 'all',
    ...extra,
    dedupeKey: `${opts.eventType}:${opts.schoolId}:${opts.entityType || 'x'}:${opts.entityId || 'x'}:${fp}:all`,
  });
  return { created: res.created ? 1 : 0, skipped: res.created ? 0 : 1 };
};

module.exports = {
  broadcast,
  EVENTS,
  fingerprint,
  resolveAudience,
  notify,
  publishNotice,
};
