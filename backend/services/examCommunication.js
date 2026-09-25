/**
 * Exam → communication pipeline (student / parent notifications).
 *
 *   ADMIN creates exam / publishes routine / publishes results
 *     → determine class + section → students → linked parents
 *     → role-specific NOTIFICATIONS (via communicationService.notify)
 *
 * The formal NOTICE for each event (per class/section "Exam Scheduled" /
 * "Exam Routine Published") is still produced by NotificationService; the
 * teacher DUTY alert is produced in examRoute.js from the invigilation data.
 * This module only adds the targeted, role-worded alerts and decides
 * PUBLISHED vs UPDATED so nothing is sent twice for unchanged data.
 */
const Notification = require('../models/Notification');
const { EVENTS, fingerprint, notify } = require('./communicationService');

const classLabel = (grade, section) => {
  const g = String(grade || '').trim();
  const cls = !g ? '' : (/^class\b/i.test(g) ? g : `Class ${g}`);
  return [cls, section ? `Section ${section}` : ''].filter(Boolean).join(', ');
};

const fmtDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value || '') : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const scopeOf = (entity) => ({
  classSections: [{
    classId: entity.classId?._id || entity.classId,
    sectionId: entity.sectionId?._id || entity.sectionId || undefined,
  }].filter((cs) => cs.classId),
});

// ── EXAM_CREATED ────────────────────────────────────────────────────────────
// entity: an ExamGroup (or a standalone Exam) with classId/sectionId/title.
const notifyExamCreated = async ({ schoolId, campusId = null, entity, entityType = 'examGroup', subjects = [], createdBy = null }) => {
  const title = String(entity?.title || 'Examination').trim();
  const dates = entity?.startDate
    ? ` from ${fmtDate(entity.startDate)}${entity.endDate && entity.endDate !== entity.startDate ? ` to ${fmtDate(entity.endDate)}` : ''}`
    : '';
  const subjectText = subjects.length ? ` Subjects: ${subjects.join(', ')}.` : '';
  return notify({
    schoolId, campusId, createdBy,
    eventType: EVENTS.EXAM_CREATED,
    entityType, entityId: entity?._id,
    priority: 'medium', category: 'exam',
    target: scopeOf(entity),
    data: { title, start: entity?.startDate || '', end: entity?.endDate || '', subjects },
    student: (s) => ({
      title: 'New Examination Scheduled',
      message: `${title} has been scheduled for your class (${classLabel(s.grade, s.section)})${dates}.${subjectText}`,
    }),
    parent: (s) => ({
      title: 'Upcoming Examination',
      message: `${title} has been scheduled for ${s.name} (${classLabel(s.grade, s.section)})${dates}.${subjectText}`,
    }),
  });
};

// ── EXAM_ROUTINE_PUBLISHED / EXAM_ROUTINE_UPDATED ──────────────────────────
// routineRows: [{ subject, date, day, time, duration }] (student-relevant only —
// no rooms/invigilators). First publish → PUBLISHED; a later publish with
// different rows → UPDATED; identical rows → nothing.
const notifyRoutinePublished = async ({ schoolId, campusId = null, group, routineRows = [], createdBy = null }) => {
  const rows = routineRows
    .map((r) => ({ subject: r.subject, date: r.date, day: r.day, time: r.time, duration: r.duration }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.time).localeCompare(String(b.time)));
  const data = { title: group?.title, rows };
  const fp = fingerprint(data);

  const prior = await Notification.findOne({
    schoolId,
    'relatedEntity.entityId': group._id,
    eventType: { $in: [EVENTS.EXAM_ROUTINE_PUBLISHED, EVENTS.EXAM_ROUTINE_UPDATED] },
  }).sort({ createdAt: -1 }).select('dedupeKey').lean();
  if (prior?.dedupeKey && prior.dedupeKey.includes(`:${fp}:`)) return { created: 0, skipped: 0, unchanged: true };
  const isUpdate = Boolean(prior);

  const title = String(group?.title || 'Examination').trim();
  const first = rows[0];
  const firstText = first
    ? ` First exam: ${first.subject} on ${fmtDate(first.date)}${first.day ? ` (${first.day})` : ''}${first.time ? ` at ${first.time}` : ''}.`
    : '';
  const count = rows.length;
  return notify({
    schoolId, campusId, createdBy,
    eventType: isUpdate ? EVENTS.EXAM_ROUTINE_UPDATED : EVENTS.EXAM_ROUTINE_PUBLISHED,
    entityType: 'examGroup', entityId: group._id,
    priority: 'high', category: 'exam',
    target: scopeOf(group),
    data,
    student: () => ({
      title: isUpdate ? 'Exam Routine Updated' : 'Exam Routine Published',
      message: isUpdate
        ? `The routine for ${title} has changed. Please check the updated dates and times.${firstText}`
        : `Your ${title} routine is now available (${count} subject${count !== 1 ? 's' : ''}).${firstText}`,
    }),
    parent: (s) => ({
      title: isUpdate ? 'Exam Routine Updated' : 'Exam Routine Published',
      message: isUpdate
        ? `${s.name}'s ${title} routine has changed. Please check the updated schedule.${firstText}`
        : `The ${title} routine for ${s.name} (${classLabel(s.grade, s.section)}) is now available.${firstText}`,
    }),
  });
};

// ── RESULT_PUBLISHED ────────────────────────────────────────────────────────
const notifyResultsPublished = async ({
  schoolId, campusId = null, classId, sectionId, examTitle = '', entityId = null, createdBy = null,
}) => {
  const label = examTitle ? `${examTitle} results` : 'Examination results';
  return notify({
    schoolId, campusId, createdBy,
    eventType: EVENTS.RESULT_PUBLISHED,
    entityType: 'result', entityId,
    priority: 'high', category: 'exam',
    target: { classSections: [{ classId, sectionId }].filter((cs) => cs.classId) },
    data: { examTitle, classId: String(classId || ''), sectionId: String(sectionId || '') },
    student: () => ({ title: 'Results Published', message: `Your ${label} have been published. Check your results.` }),
    parent: (s) => ({ title: 'Results Published', message: `${s.name}'s ${label} have been published.` }),
  });
};

module.exports = { notifyExamCreated, notifyRoutinePublished, notifyResultsPublished };
