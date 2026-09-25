/**
 * Teacher-feedback window → communication.
 *
 *   Admin saves window ─► FEEDBACK_WINDOW_* event
 *     NOTICE        → Student + Parent (system generated, one per role, kept in
 *                     sync with the window, removed when it is closed)
 *     NOTIFICATION  → Student, Parent, Teacher (bell + web push + realtime)
 *
 * Idempotent: every record carries a dedupeKey built from school + session +
 * role + window dates, so saving the same window twice sends nothing new, and
 * a date change sends one "updated" alert.
 */
const Notification = require('../models/Notification');
const School = require('../models/School');
const AcademicYear = require('../models/AcademicYear');
const NoticeCounter = require('../models/NoticeCounter');
const StudentUser = require('../models/StudentUser');
const TeacherFeedback = require('../models/TeacherFeedback');
const { ACTIVE_STUDENT_FILTER } = require('./studentStatus');
const { renderFormalNoticePdf } = require('./formalNoticePdf');
const { uploadBufferToCloudinary } = require('./cloudinaryUpload');
const { EVENTS, broadcast, notify } = require('../services/communicationService');
const { withSchoolTenant } = require('./withSchoolTenant');

const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSING_SOON_DAYS_BEFORE = 3;

const toUtcDateStart = (value) => {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
};

const dateKey = (value) => {
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? 'invalid-date' : dt.toISOString().slice(0, 10);
};

const formatDateLabel = (value) => {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dt);
};

// Opens today (or already open) vs opens on a future date.
const openingText = (startDate) => {
  const start = toUtcDateStart(startDate);
  const today = toUtcDateStart(new Date());
  return start && today && start > today ? `opens on ${formatDateLabel(startDate)}` : 'is now open';
};

// ── Wording ─────────────────────────────────────────────────────────────────
const NOTIFICATION_COPY = {
  opened: {
    Student: ({ opening, endLabel }) => ({
      title: 'Feedback Portal is Open',
      message: `The teacher feedback portal ${opening}. Please give your feedback for each of your teachers before ${endLabel}.`,
    }),
    Parent: ({ opening, endLabel }) => ({
      title: 'Feedback Portal is Ready',
      message: `The teacher feedback portal ${opening}. Please make sure your child gives feedback for each teacher before ${endLabel}. You can track their progress in Teacher Feedback.`,
    }),
    Teacher: ({ opening, endLabel }) => ({
      title: 'Feedback Window is Open',
      message: `The student feedback window ${opening} and closes on ${endLabel}.`,
    }),
  },
  updated: {
    Student: ({ startLabel, endLabel }) => ({
      title: 'Feedback Dates Changed',
      message: `The teacher feedback portal now runs from ${startLabel} to ${endLabel}.`,
    }),
    Parent: ({ startLabel, endLabel }) => ({
      title: 'Feedback Dates Changed',
      message: `The teacher feedback portal now runs from ${startLabel} to ${endLabel}.`,
    }),
    Teacher: ({ startLabel, endLabel }) => ({
      title: 'Feedback Window Dates Changed',
      message: `The student feedback window now runs from ${startLabel} to ${endLabel}.`,
    }),
  },
  expired: {
    Student: ({ endLabel }) => ({ title: 'Feedback Portal Closed', message: `The teacher feedback portal closed on ${endLabel}. Thank you for your feedback.` }),
    Parent: ({ endLabel }) => ({ title: 'Feedback Portal Closed', message: `The teacher feedback portal closed on ${endLabel}. Thank you for your cooperation.` }),
    Teacher: ({ endLabel }) => ({ title: 'Feedback Window Closed', message: `The student feedback window closed on ${endLabel}.` }),
  },
  closed: {
    Student: () => ({ title: 'Feedback Portal Closed', message: 'The teacher feedback portal has been closed by the school.' }),
    Parent: () => ({ title: 'Feedback Portal Closed', message: 'The teacher feedback portal has been closed by the school.' }),
    Teacher: () => ({ title: 'Feedback Window Closed', message: 'The student feedback window has been closed.' }),
  },
  closingSoon: {
    Student: ({ endLabel, daysLeft }) => ({
      title: 'Feedback Closing Soon',
      message: `Only ${daysLeft} day${daysLeft === 1 ? '' : 's'} left to give feedback for your teachers. The portal closes on ${endLabel}.`,
    }),
    Parent: ({ endLabel, daysLeft }) => ({
      title: 'Feedback Closing Soon',
      message: `Only ${daysLeft} day${daysLeft === 1 ? '' : 's'} left for teacher feedback. Please check that your child has rated every teacher before ${endLabel}.`,
    }),
    Teacher: ({ endLabel, daysLeft }) => ({
      title: 'Feedback Window Closing Soon',
      message: `The student feedback window closes on ${endLabel} (${daysLeft} day${daysLeft === 1 ? '' : 's'} left).`,
    }),
  },
  lastDay: {
    Student: ({ endLabel }) => ({ title: 'Last Day for Feedback!', message: `Today (${endLabel}) is the last day to give feedback for your teachers.` }),
    Parent: ({ endLabel }) => ({ title: 'Last Day for Feedback!', message: `Today (${endLabel}) is the last day for teacher feedback. Please remind your child to finish any pending teachers.` }),
    Teacher: ({ endLabel }) => ({ title: 'Feedback Window Closes Today', message: `Today (${endLabel}) is the last day for student feedback.` }),
  },
};

// ── Formal notice (system generated, Student + Parent) ──────────────────────
// One notice number per window, shared by the student and parent copies,
// e.g. KSHS/2026-27/FB/001. Re-saving the same window keeps its number.
const schoolInitials = (name = '') => String(name)
  .split(/\s+/)
  .filter((w) => /^[A-Za-z]/.test(w))
  .map((w) => w[0].toUpperCase())
  .join('') || 'SCH';

const shortSession = (name = '') => {
  const m = String(name).match(/(\d{4})\s*[-–/]\s*(\d{2,4})/);
  return m ? `${m[1]}-${m[2].slice(-2)}` : String(name || '').trim();
};

const nextNoticeNumber = async ({ schoolId, schoolName, sessionName }) => {
  const session = shortSession(sessionName);
  const counter = await NoticeCounter.findOneAndUpdate(
    { schoolId, key: `FB:${session}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return `${schoolInitials(schoolName)}/${session}/FB/${String(counter.seq).padStart(3, '0')}`;
};

const boardLabel = (school) => {
  if (!school?.board) return '';
  return school.board === 'Other' ? (school.boardOther || '') : school.board;
};

const buildNoticeDocument = ({ role, school, sessionName, noticeNo, startDate, endDate, publishedAt }) => {
  const sessionLabel = String(sessionName || '').replace(/\s*-\s*/, '–');
  const isStudent = role === 'Student';
  return {
    template: 'formal_notice',
    school: {
      name: school?.name || '',
      address: school?.address || '',
      board: boardLabel(school),
      email: school?.contactEmail || school?.officialEmail || '',
      phone: school?.contactPhone || '',
      logoUrl: school?.logo?.secure_url || '',
    },
    noticeNo,
    date: publishedAt,
    heading: 'NOTICE',
    subject: `STUDENT FEEDBACK WINDOW – ${sessionLabel}`,
    salutation: isStudent ? 'Dear Student,' : 'Dear Parent/Guardian,',
    paragraphs: [
      `This is to inform all concerned that the Student Feedback Window for the Academic Session ${sessionLabel} has been opened by the school administration.`,
      'Students are requested to provide their valuable feedback regarding their teachers through the Student Feedback Portal within the scheduled period.',
    ],
    detailsTitle: 'FEEDBACK DETAILS',
    details: [
      { label: 'Academic Session', value: sessionLabel },
      { label: 'Feedback Opens', value: formatDateLabel(startDate) },
      { label: 'Feedback Closes', value: formatDateLabel(endDate) },
    ],
    sections: isStudent
      ? [{
        title: 'For Students:',
        text: 'Please log in to your Student Portal and complete the feedback for all your assigned teachers before the closing date. Your responses are confidential.',
      }]
      : [{
        title: 'For Parents/Guardians:',
        text: "Kindly remind and encourage your child to complete the feedback within the scheduled period. The feedback portal can be accessed through the student's account, and you can track which teachers your child has completed under Teacher Feedback in the Parent Portal.",
      }],
    closing: [
      'Your feedback is valuable to the school and will help us continuously improve the teaching and learning experience.',
      `${isStudent ? 'Students are' : 'Parents/Guardians are'} requested to ensure the process is completed within the specified period.`,
      'Thank you for your cooperation.',
    ],
    signature: ['By Order,', 'School Administration', school?.name || ''],
    footer: 'Note: This is a system-generated notice published through the EEC School Management System.',
  };
};

// Plain-text copy of the formal notice (bell previews, search, push, share).
const noticeToText = (doc) => [
  doc.salutation,
  '',
  ...doc.paragraphs,
  '',
  ...doc.details.map((d) => `${d.label}: ${d.value}`),
  '',
  ...doc.sections.map((s) => `${s.title} ${s.text}`),
  '',
  ...doc.closing,
].join('\n');

const ROLES = ['Student', 'Parent', 'Teacher'];
const NOTICE_ROLES = ['Student', 'Parent'];
const noticeKey = (schoolId, sessionId, role) => `feedback-notice:${schoolId}:${sessionId}:${role}`;

// Render the notice as a PDF and upload it; one fixed file per school/session/
// role, overwritten when the window changes. Failure never blocks the notice.
const buildNoticeAttachment = async ({ document, schoolId, sessionId, role }) => {
  try {
    const buffer = await renderFormalNoticePdf(document);
    const fileName = `Notice-${String(document.noticeNo || 'feedback').replace(/[^A-Za-z0-9-]+/g, '-')}-${role}.pdf`;
    const uploaded = await uploadBufferToCloudinary(buffer, {
      folder: 'notices',
      public_id: `feedback_${schoolId}_${sessionId}_${role.toLowerCase()}`,
      // No '.pdf' extension: this Cloudinary account blocks PDF delivery by
      // extension (401), the same reason other notice attachments are raw.
      resource_type: 'raw',
      use_filename: false,
      unique_filename: false,
      overwrite: true,
      invalidate: true,
    });
    return [{ name: fileName, url: uploaded.secure_url, size: buffer.length, type: 'application/pdf' }];
  } catch (err) {
    console.error('[teacher-feedback] notice PDF failed:', err.message);
    return null;
  }
};

// fresh = a newly opened window (first open, or reopened after closing):
// it gets a new notice number and date instead of reusing the old notice's.
const upsertNotices = async ({ schoolId, sessionId, startDate, endDate, fresh = false }) => {
  const [school, session, existing] = await Promise.all([
    School.findById(schoolId).select('name address board boardOther contactEmail officialEmail contactPhone logo').lean(),
    AcademicYear.findById(sessionId).select('name').lean(),
    Notification.find({ dedupeKey: { $in: NOTICE_ROLES.map((r) => noticeKey(schoolId, sessionId, r)) } })
      .select('_id dedupeKey document').lean(),
  ]);
  const existingByKey = new Map(existing.map((d) => [d.dedupeKey, d]));
  const reuse = fresh ? [] : existing;
  const noticeNo = reuse.find((d) => d.document?.noticeNo)?.document.noticeNo
    || await nextNoticeNumber({ schoolId, schoolName: school?.name, sessionName: session?.name });
  const publishedAt = reuse.find((d) => d.document?.date)?.document.date || new Date();
  const sessionTitle = String(session?.name || '').replace(/\s*-\s*/, '–');

  for (const role of NOTICE_ROLES) {
    const dedupeKey = noticeKey(schoolId, sessionId, role);
    const document = buildNoticeDocument({
      role, school, sessionName: session?.name || '', noticeNo, startDate, endDate, publishedAt,
    });
    const fields = {
      schoolId,
      campusId: null,
      title: `Student Feedback Window – ${sessionTitle}`,
      message: noticeToText(document),
      document,
      audience: role,
      kind: 'notice',
      eventType: EVENTS.FEEDBACK_WINDOW_OPENED,
      targetRole: role.toLowerCase(),
      type: 'notice',
      typeLabel: 'feedback_window',
      category: 'academic',
      priority: 'medium',
      isPinned: true,
      createdByType: 'admin',
      createdByName: 'School Administration',
      // No expiresAt: after the window ends the notice stays on record,
      // just unpinned (see autoCloseExpiredWindows).
      relatedEntity: { entityType: 'feedbackWindow', entityId: sessionId },
    };
    // eslint-disable-next-line no-await-in-loop
    const attachments = await buildNoticeAttachment({ document, schoolId, sessionId, role });
    if (attachments) fields.attachments = attachments;
    const prev = existingByKey.get(dedupeKey);
    if (prev) {
      // eslint-disable-next-line no-await-in-loop
      await Notification.updateOne({ _id: prev._id }, { $set: fields });
    } else {
      try {
        // eslint-disable-next-line no-await-in-loop
        await Notification.create({ ...fields, dedupeKey });
      } catch (err) {
        if (err?.code !== 11000) throw err;
      }
    }
  }
};

const removeNotices = ({ schoolId, sessionId }) => Notification.deleteMany({
  dedupeKey: { $in: NOTICE_ROLES.map((role) => noticeKey(schoolId, sessionId, role)) },
});

// ── Notifications (Student, Parent, Teacher) ────────────────────────────────
const sendAlerts = async ({ schoolId, sessionId, eventType, stage, vars, data, expiresAt, priority = 'medium' }) => {
  let created = 0;
  for (const role of ROLES) {
    const copy = NOTIFICATION_COPY[stage][role](vars);
    // eslint-disable-next-line no-await-in-loop
    const res = await broadcast({
      schoolId,
      campusId: null,
      eventType,
      entityType: 'feedbackWindow',
      entityId: sessionId,
      category: 'academic',
      priority,
      audience: role,
      data: { ...data, role, stage },
      ...copy,
      extra: {
        targetRole: role.toLowerCase(),
        typeLabel: `feedback_${stage}`,
        createdByName: 'System',
        // Alerts stay in the bell (no expiresAt) — expiring them with the
        // window made them vanish, e.g. when the end date was already past.
      },
    });
    created += res.created;
  }
  return { created };
};

/**
 * Called after the admin saves a window.
 * before: previous { enabled, startDate, endDate } (or null); after: the saved one.
 */
const handleFeedbackWindowChange = async ({ schoolId, sessionId, before = null, after }) => {
  if (!schoolId || !sessionId || !after) return { created: 0 };
  const wasEnabled = Boolean(before?.enabled);
  const isEnabled = Boolean(after.enabled) && after.startDate && after.endDate;

  if (!isEnabled) {
    if (!wasEnabled) return { created: 0 };
    await removeNotices({ schoolId, sessionId });
    return sendAlerts({
      schoolId, sessionId,
      eventType: EVENTS.FEEDBACK_WINDOW_CLOSED,
      stage: 'closed',
      vars: {},
      data: { closedAt: dateKey(new Date()), prevEnd: dateKey(before?.endDate) },
    });
  }

  const datesChanged = wasEnabled
    && (dateKey(before.startDate) !== dateKey(after.startDate) || dateKey(before.endDate) !== dateKey(after.endDate));
  if (wasEnabled && !datesChanged) return { created: 0, unchanged: true };

  await upsertNotices({ schoolId, sessionId, startDate: after.startDate, endDate: after.endDate, fresh: !wasEnabled });

  const vars = {
    opening: openingText(after.startDate),
    startLabel: formatDateLabel(after.startDate),
    endLabel: formatDateLabel(after.endDate),
  };
  return sendAlerts({
    schoolId, sessionId,
    eventType: datesChanged ? EVENTS.FEEDBACK_WINDOW_UPDATED : EVENTS.FEEDBACK_WINDOW_OPENED,
    stage: datesChanged ? 'updated' : 'opened',
    vars,
    data: { start: dateKey(after.startDate), end: dateKey(after.endDate) },
    expiresAt: after.endDate,
  });
};

// Back-compat wrapper for older callers.
const notifyTeacherFeedbackWindowStarted = ({ schoolId, sessionId, startDate, endDate }) => handleFeedbackWindowChange({
  schoolId, sessionId, before: null, after: { enabled: true, startDate, endDate },
});

// ── Automatic reminders ─────────────────────────────────────────────────────
// Students who still have teachers pending, plus their linked parents, get a
// "closing soon" (≤3 days left) and a "last day" reminder — once each per
// window. Students who finished everything are not bothered. Teachers get one
// general heads-up.
const REMINDER_COPY = {
  closingSoon: {
    student: ({ endLabel, daysLeft }) => ({
      title: 'Feedback Closing Soon',
      message: `The teacher feedback portal closes in ${daysLeft} day${daysLeft === 1 ? '' : 's'} (${endLabel}). You still have teachers pending — please provide your feedback.`,
    }),
    parent: ({ endLabel, daysLeft, childName, pending }) => ({
      title: 'Feedback Closing Soon',
      message: `${childName} has not yet given feedback for ${pending} teacher${pending === 1 ? '' : 's'}. The portal closes in ${daysLeft} day${daysLeft === 1 ? '' : 's'} (${endLabel}) — please remind ${childName} to complete it.`,
    }),
  },
  lastDay: {
    student: ({ endLabel }) => ({
      title: 'Last Day for Feedback!',
      message: `Today (${endLabel}) is the last day of the teacher feedback portal. Please complete your pending feedback before it closes.`,
    }),
    parent: ({ endLabel, childName, pending }) => ({
      title: 'Last Day for Feedback!',
      message: `Today (${endLabel}) is the last day for teacher feedback. ${childName} still has ${pending} teacher${pending === 1 ? '' : 's'} pending — please remind ${childName} to finish today.`,
    }),
  },
};

const keyOfContext = (t) => `${t.teacherId}::${t.subjectId || String(t.subjectName || '').toLowerCase()}`;

// studentId → number of allocated teachers without feedback in this window.
const findPendingStudents = async ({ schoolId, startDate }) => {
  const { buildTeacherFeedbackContext } = require('../routes/studentRoute').feedbackHelpers;
  const students = await StudentUser.find({ schoolId, ...ACTIVE_STUDENT_FILTER })
    .select('_id name grade section schoolId campusId').lean();
  if (!students.length) return new Map();

  const given = await TeacherFeedback.find({
    schoolId,
    studentId: { $in: students.map((s) => s._id) },
    respondentType: { $ne: 'parent' },
    createdAt: { $gte: new Date(startDate) },
  }).select('studentId teacherId subjectId subjectName').lean();
  const givenByStudent = new Map();
  given.forEach((g) => {
    const k = String(g.studentId);
    if (!givenByStudent.has(k)) givenByStudent.set(k, new Set());
    givenByStudent.get(k).add(keyOfContext({
      teacherId: String(g.teacherId), subjectId: g.subjectId ? String(g.subjectId) : null, subjectName: g.subjectName,
    }));
  });

  const contextCache = new Map(); // grade|section|campus → expected teacher keys
  const pending = new Map();
  for (const s of students) {
    const cacheKey = `${s.grade}|${s.section}|${s.campusId || ''}`;
    if (!contextCache.has(cacheKey)) {
      // eslint-disable-next-line no-await-in-loop
      const { contexts } = await buildTeacherFeedbackContext(s);
      contextCache.set(cacheKey, contexts.map(keyOfContext));
    }
    const expected = contextCache.get(cacheKey);
    if (!expected.length) continue;
    const done = givenByStudent.get(String(s._id)) || new Set();
    const left = expected.filter((k) => !done.has(k)).length;
    if (left > 0) pending.set(String(s._id), left);
  }
  return pending;
};

const sendPendingReminders = async ({ schoolId, sessionId, stage, startDate, endDate, daysLeft }) => {
  const pending = await findPendingStudents({ schoolId, startDate });
  if (!pending.size) return { created: 0 };
  const endLabel = formatDateLabel(endDate);
  const copy = REMINDER_COPY[stage];
  const res = await notify({
    schoolId,
    campusId: null,
    eventType: EVENTS.FEEDBACK_WINDOW_REMINDER,
    entityType: 'feedbackWindow',
    entityId: sessionId,
    category: 'academic',
    priority: stage === 'lastDay' ? 'high' : 'medium',
    target: { studentIds: [...pending.keys()] },
    // Stage + window only, so each class/child is reminded once per stage.
    data: { stage, end: dateKey(endDate) },
    student: () => ({ ...copy.student({ endLabel, daysLeft }), typeLabel: `feedback_${stage}` }),
    parent: (s) => ({
      ...copy.parent({ endLabel, daysLeft, childName: s.name, pending: pending.get(String(s._id)) || 1 }),
      typeLabel: `feedback_${stage}`,
    }),
  });
  return { created: res.created };
};

const sendTeacherReminder = async ({ schoolId, sessionId, stage, endDate, daysLeft }) => {
  const content = NOTIFICATION_COPY[stage].Teacher({ endLabel: formatDateLabel(endDate), daysLeft });
  const res = await broadcast({
    schoolId,
    campusId: null,
    eventType: EVENTS.FEEDBACK_WINDOW_REMINDER,
    entityType: 'feedbackWindow',
    entityId: sessionId,
    category: 'academic',
    priority: stage === 'lastDay' ? 'high' : 'medium',
    audience: 'Teacher',
    data: { stage, end: dateKey(endDate), role: 'Teacher' },
    ...content,
    extra: { targetRole: 'teacher', typeLabel: `feedback_${stage}`, createdByName: 'System' },
  });
  return { created: res.created };
};

// ── Auto-close ──────────────────────────────────────────────────────────────
// Once the last date has passed: switch the window off (admin sees "Off"),
// unpin its notices (they stay on the Notices pages as a record) and send one
// "Feedback Portal Closed" alert per role.
const autoCloseExpiredWindows = async () => {
  const now = new Date();
  const schools = await School.find({
    teacherFeedbackWindows: { $elemMatch: { enabled: true, endDate: { $lt: now } } },
  }).select('_id teacherFeedbackWindows').lean();

  let closed = 0;
  for (const school of schools) {
    // eslint-disable-next-line no-await-in-loop
    closed += await withSchoolTenant(school._id, async () => {
    let closedHere = 0;
    const expired = (school.teacherFeedbackWindows || []).filter((w) => w.enabled && w.endDate && new Date(w.endDate) < now);
    for (const window of expired) {
      // eslint-disable-next-line no-await-in-loop
      const res = await School.updateOne(
        { _id: school._id },
        { $set: { 'teacherFeedbackWindows.$[w].enabled': false } },
        { arrayFilters: [{ 'w.sessionId': window.sessionId, 'w.enabled': true }] },
      );
      if (!res.modifiedCount) continue; // another run already closed it
      closedHere += 1;
      // eslint-disable-next-line no-await-in-loop
      await Notification.updateMany(
        { dedupeKey: { $in: NOTICE_ROLES.map((role) => noticeKey(school._id, window.sessionId, role)) } },
        { $set: { isPinned: false }, $unset: { expiresAt: '' } },
      );
      // eslint-disable-next-line no-await-in-loop
      await sendAlerts({
        schoolId: school._id,
        sessionId: window.sessionId,
        eventType: EVENTS.FEEDBACK_WINDOW_CLOSED,
        stage: 'expired',
        vars: { endLabel: formatDateLabel(window.endDate) },
        data: { auto: true, end: dateKey(window.endDate) },
      });
    }
    return closedHere;
    });
  }
  return closed;
};

// Runs every few hours (see teacherFeedbackReminderScheduler). Dedupe keys make
// each stage fire once, and the ≤3-day range means a missed run still catches up.
const dispatchTeacherFeedbackReminders = async () => {
  const todayUtc = toUtcDateStart(new Date());
  if (!todayUtc) return { scanned: 0, created: 0 };
  const autoClosed = await autoCloseExpiredWindows();

  const schools = await School.find({
    teacherFeedbackWindows: { $elemMatch: { enabled: true, endDate: { $gte: todayUtc } } },
  }).select('_id teacherFeedbackWindows').lean();

  let created = 0;
  let scanned = 0;
  for (const school of schools) {
    const windows = (school.teacherFeedbackWindows || []).filter((w) => w.enabled && w.endDate && w.startDate);
    for (const window of windows) {
      scanned += 1;
      const endUtc = toUtcDateStart(window.endDate);
      const startUtc = toUtcDateStart(window.startDate);
      if (!endUtc || !startUtc || startUtc > todayUtc) continue;
      const daysLeft = Math.round((endUtc.getTime() - todayUtc.getTime()) / DAY_MS);
      let stage = null;
      if (daysLeft === 0) stage = 'lastDay';
      else if (daysLeft >= 1 && daysLeft <= CLOSING_SOON_DAYS_BEFORE) stage = 'closingSoon';
      if (!stage) continue;

      const args = {
        schoolId: school._id, sessionId: window.sessionId, stage, startDate: window.startDate, endDate: window.endDate, daysLeft,
      };
      // Cron has no request tenant — run in the school's so records are scoped/visible.
      // eslint-disable-next-line no-await-in-loop
      const [a, b] = await withSchoolTenant(school._id, () => Promise.all([sendPendingReminders(args), sendTeacherReminder(args)]));
      created += a.created + b.created;
    }
  }
  return { scanned, created, autoClosed };
};

module.exports = {
  autoCloseExpiredWindows,
  // Rebuild notices for an open window without sending alerts (maintenance).
  refreshFeedbackNotices: upsertNotices,
  handleFeedbackWindowChange,
  notifyTeacherFeedbackWindowStarted,
  dispatchTeacherFeedbackReminders,
};
