/**
 * Exam → formal NOTICE (one per exam, not one per class/section).
 *
 * "Create All" / "Publish All" fire one request per class/section group, often
 * concurrently. Instead of each request writing its own notice, every request
 * just calls scheduleExamNoticeRefresh(); after a short debounce the notice is
 * REBUILT FROM THE DATABASE (all groups with that exam title in that session),
 * so the result is always complete and there is exactly one notice:
 *
 *   EXAM SCHEDULED  (typeLabel exam_notice_scheduled) — classes, sections,
 *                   dates, times (if known), instructions, PDF.
 *   EXAM ROUTINE    (typeLabel exam_notice_routine)   — same + class-wise,
 *                   subject-wise routine tables for every published group, PDF.
 *                   When it exists the "scheduled" notice is unpinned.
 *
 * Audience 'All' (students, parents and staff — a school announcement). The
 * targeted student/parent bell alerts and teacher duty alerts are sent
 * separately (examCommunication / examRoute).
 */
const mongoose = require('mongoose');
const ExamGroup = require('../models/ExamGroup');
const Exam = require('../models/Exam');
const AcademicYear = require('../models/AcademicYear');
const Notification = require('../models/Notification');
// Registered for populate() (subjectId / classId / sectionId).
require('../models/Subject');
require('../models/Class');
require('../models/Section');
const { runWithTenant, getTenantContext } = require('../utils/tenantContext');
const { resolveAudience, fingerprint } = require('./communicationService');
const { withSchoolTenant } = require('../utils/withSchoolTenant');
const {
  sessionLabel, formatDateLabel, nextNoticeNumber, loadSchoolHeader, noticeToText,
  buildNoticePdfAttachments, SIGNATURE, FOOTER,
} = require('../utils/formalNoticeCommon');

const DEBOUNCE_MS = 2500;
const PDF_LAYOUT_VERSION = 3;
const timers = new Map();

const slug = (v) => String(v || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ── Formatting helpers ──────────────────────────────────────────────────────
const to12h = (hhmm) => {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(hhmm || '');
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
};
const addMinutes = (hhmm, mins) => {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m || !Number.isFinite(Number(mins))) return '';
  const total = Number(m[1]) * 60 + Number(m[2]) + Number(mins);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
const timeRange = (start, duration) => {
  const end = addMinutes(start, duration);
  return end ? `${to12h(start)} – ${to12h(end)}` : to12h(start);
};
const shortDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value || '') : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
const weekday = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
};
const classLabel = (name) => {
  const g = String(name || '').trim();
  return /^class\b/i.test(g) ? g : `Class ${g}`;
};
const classSortKey = (name) => {
  const n = parseInt(String(name).replace(/^class\s*/i, ''), 10);
  return Number.isFinite(n) ? n : 999;
};

// ── Session resolution ──────────────────────────────────────────────────────
const resolveSession = async (schoolId, dateStr) => {
  const date = dateStr ? new Date(dateStr) : null;
  if (date && !Number.isNaN(date.getTime())) {
    const s = await AcademicYear.findOne({ schoolId, startDate: { $lte: date }, endDate: { $gte: date } }).select('name startDate endDate').lean();
    if (s) return s;
  }
  return AcademicYear.findOne({ schoolId, isActive: true }).select('name startDate endDate').lean();
};

// All groups of this exam (same title + campus) inside the session.
const loadExamGroups = async ({ schoolId, campusId, title, session }) => {
  const groups = await ExamGroup.find({
    schoolId,
    ...(campusId ? { campusId } : {}),
    title: { $regex: `^${String(title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
  })
    .populate('classId', 'name')
    .populate('sectionId', 'name')
    .lean();
  if (!session?.startDate || !session?.endDate) return groups;
  const from = new Date(session.startDate);
  const to = new Date(session.endDate);
  return groups.filter((g) => {
    const d = g.startDate ? new Date(g.startDate) : new Date(g.createdAt);
    return Number.isNaN(d.getTime()) || (d >= from && d <= to);
  });
};

const groupClassName = (g) => g.classId?.name || g.grade || '';
const groupSectionName = (g) => g.sectionId?.name || g.section || '';

// ── Document builders ───────────────────────────────────────────────────────
const INSTRUCTIONS = [
  'Students must report to the examination venue before the reporting time.',
  'Students must carry their required examination materials and school identity card.',
  'Students are advised to carefully check their individual examination routine available in the Student Portal.',
  'Students must follow all examination rules and instructions issued by the school.',
  'Any changes to the examination schedule will be communicated through the official school communication system.',
];

const dateRange = (groups, exams) => {
  const starts = groups.map((g) => g.startDate).filter(Boolean).sort();
  const ends = groups.map((g) => g.endDate || g.startDate).filter(Boolean).sort();
  const examDates = exams.map((e) => String(e.date || '').slice(0, 10)).filter(Boolean).sort();
  return {
    from: examDates[0] || starts[0],
    to: examDates[examDates.length - 1] || ends[ends.length - 1],
  };
};

const timeDetails = (exams) => {
  const times = exams.map((e) => e.time).filter(Boolean).sort();
  if (!times.length) return [];
  const slots = new Set(exams.filter((e) => e.time).map((e) => `${e.time}|${e.duration || ''}`));
  const [t, d] = [...slots][0].split('|');
  return [
    { label: 'Reporting Time', value: to12h(addMinutes(times[0], -30) || times[0]) },
    { label: 'Examination Time', value: slots.size === 1 ? timeRange(t, d) : 'As per the examination routine' },
  ];
};

const classesDetails = (groups) => {
  const classes = [...new Set(groups.map(groupClassName).filter(Boolean))].sort((a, b) => classSortKey(a) - classSortKey(b) || a.localeCompare(b));
  const sections = [...new Set(groups.map(groupSectionName).filter(Boolean))].sort();
  const out = [{ label: 'Classes', value: classes.map((c) => c.replace(/^class\s*/i, '')).join(', ') }];
  if (sections.length) out.push({ label: 'Sections', value: sections.join(', ') });
  return out;
};

const routineTable = (group, groupExams) => ({
  title: [classLabel(groupClassName(group)), groupSectionName(group) && `Section ${groupSectionName(group)}`].filter(Boolean).join(' – '),
  columns: ['Date', 'Day', 'Subject', 'Time', 'Duration'],
  widths: [1.2, 1.1, 2.2, 1.6, 0.9],
  rows: [...groupExams]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.time).localeCompare(String(b.time)))
    .map((e) => [
      shortDate(e.date),
      weekday(e.date),
      e.subjectId?.name || e.subject || 'Subject',
      e.time ? timeRange(e.time, e.duration) : '—',
      e.duration ? `${e.duration} min` : '—',
    ]),
});

const sortGroups = (groups) => [...groups].sort((a, b) => classSortKey(groupClassName(a)) - classSortKey(groupClassName(b))
  || groupClassName(a).localeCompare(groupClassName(b))
  || groupSectionName(a).localeCompare(groupSectionName(b)));

// Per-role versions: a student reads "Dear Student," + only the student
// section, a parent "Dear Parent/Guardian," + only the parent section (the
// combined text remains for admin/staff).
const roleVariants = (forStudents, forParents) => ({
  student: { salutation: 'Dear Student,', sections: [forStudents] },
  parent: { salutation: 'Dear Parent/Guardian,', sections: [forParents] },
});

/**
 * kind:
 *   'scheduled'    — exam announced; dates only, "routine will be published soon"
 *   'routine'      — consolidated routine of every class (admin + teachers)
 *   'routineClass' — one class/section's routine (that class's students + parents)
 */
const buildDocument = ({ kind, title, session, school, noticeNo, publishedAt, groups, exams }) => {
  const sLabel = sessionLabel(session?.name);
  const { from, to } = dateRange(groups, exams);
  const base = {
    template: 'formal_notice',
    school,
    noticeNo,
    date: publishedAt,
    heading: 'NOTICE',
    salutation: 'Dear Students and Parents/Guardians,',
    detailsTitle: 'EXAMINATION DETAILS',
    signature: SIGNATURE(school.name),
    footer: FOOTER,
  };
  const dateDetails = [
    ...(from ? [{ label: 'Examination From', value: formatDateLabel(from) }] : []),
    ...(to ? [{ label: 'Examination To', value: formatDateLabel(to) }] : []),
  ];
  const nameDetails = [
    { label: 'Examination Name', value: title },
    { label: 'Academic Session', value: sLabel },
  ];

  if (kind === 'scheduled') {
    // **…** = bold (exam name, session, dates) — rendered by FormalNotice and the PDF.
    const range = from && to ? ` from **${formatDateLabel(from)}** to **${formatDateLabel(to)}**` : '';
    const forStudents = { title: 'For Students:', text: 'Please prepare for the examination. Your subject-wise routine will appear in the Student Portal as soon as it is published.' };
    const forParents = { title: 'For Parents/Guardians:', text: "Please help your child prepare for the examination. You will be notified as soon as your child's routine is published." };
    return {
      ...base,
      subject: `${title} – ${sLabel}`.toUpperCase(),
      paragraphs: [
        `This is to inform all concerned that **${title}** for the Academic Session **${sLabel}** has been scheduled by the school administration and will be held${range}.`,
        'The detailed class-wise and subject-wise examination routine will be published soon. Students are requested to begin their preparation and keep checking the Student Portal for the routine.',
      ],
      // Classes only — sections vary per class and are not listed here.
      details: [...nameDetails, classesDetails(groups)[0], ...dateDetails, { label: 'Routine', value: 'Will be published soon' }],
      sections: [forStudents, forParents],
      variants: roleVariants(forStudents, forParents),
      closing: ['We wish all students the very best for their examinations.'],
    };
  }

  const examsByGroup = new Map();
  exams.forEach((e) => {
    const k = String(e.groupId);
    if (!examsByGroup.has(k)) examsByGroup.set(k, []);
    examsByGroup.get(k).push(e);
  });
  const withExams = sortGroups(groups.filter((g) => examsByGroup.has(String(g._id))));
  const common = {
    instructionsTitle: 'IMPORTANT INSTRUCTIONS',
    instructions: INSTRUCTIONS,
    closing: ['We wish all students the very best for their examinations.'],
  };

  if (kind === 'routineClass') {
    const group = groups[0];
    const cls = [classLabel(groupClassName(group)), groupSectionName(group) && `Section ${groupSectionName(group)}`].filter(Boolean).join(', ');
    const forStudents = { title: 'For Students:', text: 'Please follow the routine above and report to the examination venue on time with your identity card.' };
    const forParents = { title: 'For Parents/Guardians:', text: 'Please ensure that your child is prepared and reaches the examination venue on time as per the routine above.' };
    const range = from && to ? ` The examination will be held from **${formatDateLabel(from)}** to **${formatDateLabel(to)}**.` : '';
    return {
      ...base,
      ...common,
      tablesFirst: true,
      variants: roleVariants(forStudents, forParents),
      subject: `${title} – EXAMINATION ROUTINE – ${sLabel}`.toUpperCase(),
      paragraphs: [
        `This is to inform all concerned that the examination routine of **${title}** for **${cls}** for the Academic Session **${sLabel}** has been published by the school administration.${range}`,
        'The subject-wise routine is given below. Students are requested to carefully note the date and time of each examination and appear accordingly.',
      ],
      details: [
        ...nameDetails,
        { label: 'Class', value: groupClassName(group).replace(/^class\s*/i, '') },
        ...(groupSectionName(group) ? [{ label: 'Section', value: groupSectionName(group) }] : []),
        ...dateDetails,
        ...timeDetails(exams),
      ],
      tables: withExams.map((g) => routineTable(g, examsByGroup.get(String(g._id)))),
      sections: [forStudents, forParents],
    };
  }

  // 'routine' — consolidated (admin + teachers)
  return {
    ...base,
    ...common,
    salutation: 'To all concerned,',
    subject: `${title} – EXAMINATION ROUTINE – ${sLabel}`.toUpperCase(),
    paragraphs: [
      `The examination routine of ${title} for the Academic Session ${sLabel} has been published. Each class's students and parents have received the routine of their own class and section.`,
      'The complete class-wise and subject-wise routine is given below for staff reference.',
    ],
    details: [...nameDetails, ...classesDetails(groups), ...dateDetails, ...timeDetails(exams)],
    tables: withExams.map((g) => routineTable(g, examsByGroup.get(String(g._id)))),
    sections: [
      { title: 'For Teachers:', text: 'Please check "My Exam Duty" in the Teacher Portal for your invigilation duties.' },
    ],
  };
};

// ── Refresh (rebuild from DB) ───────────────────────────────────────────────
const noticeKeyFor = ({ kind, schoolId, campusId, sessionId, title }) => `exam-notice:${kind}:${schoolId}:${campusId || 'x'}:${sessionId || 'x'}:${slug(title)}`;

const upsertNotice = async (dedupeKey, fields, existingId) => {
  if (existingId) return Notification.findByIdAndUpdate(existingId, { $set: fields }, { new: true });
  try {
    return await Notification.create({ ...fields, dedupeKey });
  } catch (err) {
    if (err?.code !== 11000) throw err;
    return Notification.findOneAndUpdate({ dedupeKey }, { $set: fields }, { new: true });
  }
};

// Build + attach the PDF only when the notice content actually changed.
const withPdf = async ({ document, existing, publicId, fileName }) => {
  // Bump PDF_LAYOUT_VERSION whenever formalNoticePdf.js changes so existing
  // PDFs are re-rendered even if the notice content itself didn't change.
  const fp = fingerprint({ ...document, date: String(document.date), layout: PDF_LAYOUT_VERSION });
  if (existing?.document?.fp === fp && existing?.attachments?.length) {
    return { document: { ...document, fp }, attachments: existing.attachments };
  }
  const attachments = await buildNoticePdfAttachments({ document, publicId, fileName });
  return { document: { ...document, fp: attachments ? fp : '' }, attachments };
};

const baseNoticeFields = ({ schoolId, campusId, createdBy, kind }) => ({
  schoolId,
  campusId: campusId || null,
  kind: 'notice',
  eventType: kind === 'scheduled' ? 'EXAM_CREATED' : 'EXAM_ROUTINE_PUBLISHED',
  type: 'notice',
  category: 'exam',
  priority: kind === 'scheduled' ? 'medium' : 'high',
  isPinned: true,
  createdByType: 'admin',
  createdByName: 'School Administration',
  ...(createdBy && mongoose.isValidObjectId(createdBy) ? { createdBy } : {}),
});

// Public entry: always runs in the school's tenant (scripts/timers included).
const refreshExamNotice = (opts) => withSchoolTenant(opts.schoolId, () => refreshExamNoticeInTenant(opts));

const refreshExamNoticeInTenant = async ({ kind, schoolId, campusId = null, title, sampleDate = null, createdBy = null }) => {
  const session = await resolveSession(schoolId, sampleDate);
  const dedupeKey = noticeKeyFor({ kind, schoolId, campusId, sessionId: session?._id, title });
  const classKeyPrefix = `${dedupeKey}:class:`;
  const allGroups = await loadExamGroups({ schoolId, campusId, title, session });
  const groups = kind === 'routine'
    ? allGroups.filter((g) => g.status === 'Published' || g.publishedAt)
    : allGroups;

  const existing = await Notification.findOne({ dedupeKey }).select('_id document attachments').lean();
  if (!groups.length) {
    // Exam deleted / nothing published any more → remove its notice(s).
    if (existing) await Notification.deleteOne({ _id: existing._id });
    if (kind === 'routine') await Notification.deleteMany({ dedupeKey: { $regex: `^${classKeyPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` } });
    return null;
  }

  const exams = await Exam.find({ groupId: { $in: groups.map((g) => g._id) } })
    .select('groupId subject subjectId date time duration')
    .populate('subjectId', 'name')
    .lean();

  const school = await loadSchoolHeader(schoolId);
  const noticeNo = existing?.document?.noticeNo
    || await nextNoticeNumber({ schoolId, schoolName: school.name, sessionName: session?.name, series: 'EXAM' });
  const publishedAt = existing?.document?.date || new Date();
  const fileBase = `Notice-${noticeNo.replace(/[^A-Za-z0-9-]+/g, '-')}-${slug(title)}`;

  // ── Main notice: "scheduled" (everyone) or consolidated routine (admin + teachers) ──
  const main = await withPdf({
    document: buildDocument({ kind, title, session, school, noticeNo, publishedAt, groups, exams }),
    existing,
    publicId: `exam_${kind}_${schoolId}_${campusId || 'x'}_${session?._id || 'x'}_${slug(title)}`,
    fileName: `${fileBase}${kind === 'routine' ? '-routine-all-classes' : ''}.pdf`,
  });
  const saved = await upsertNotice(dedupeKey, {
    ...baseNoticeFields({ schoolId, campusId, createdBy, kind }),
    title: kind === 'routine' ? `Exam Routine Published: ${title} (All Classes)` : `Exam Scheduled: ${title}`,
    message: noticeToText(main.document),
    document: main.document,
    ...(main.attachments ? { attachments: main.attachments } : {}),
    // The all-classes routine is for staff; students/parents get their class's copy below.
    audience: kind === 'routine' ? 'Teacher' : 'All',
    targetRole: kind === 'routine' ? 'teacher' : 'all',
    typeLabel: kind === 'routine' ? 'exam_notice_routine' : 'exam_notice_scheduled',
    relatedEntity: { entityType: 'examGroup', entityId: groups[0]._id },
  }, existing?._id);

  if (kind !== 'routine') return saved;

  // ── Per class/section routine notices: only that class's students + their parents ──
  const liveKeys = [];
  for (const group of sortGroups(groups)) {
    const groupExams = exams.filter((e) => String(e.groupId) === String(group._id));
    if (!groupExams.length) continue;
    const classKey = `${classKeyPrefix}${group._id}`;
    liveKeys.push(classKey);
    const clsCode = `${groupClassName(group).replace(/^class\s*/i, '').replace(/\s+/g, '')}${groupSectionName(group)}`.replace(/[^A-Za-z0-9-]+/g, '');

    // eslint-disable-next-line no-await-in-loop
    const [prev, audience] = await Promise.all([
      Notification.findOne({ dedupeKey: classKey }).select('_id document attachments').lean(),
      resolveAudience({
        schoolId,
        campusId,
        target: { classSections: [{ classId: group.classId?._id || group.classId, sectionId: group.sectionId?._id || group.sectionId || undefined }] },
      }),
    ]);
    const recipients = [...audience.students.map((s) => s._id), ...audience.parentIds];
    if (!recipients.length) {
      // No students in this class right now → no class copy.
      // eslint-disable-next-line no-await-in-loop
      if (prev) await Notification.deleteOne({ _id: prev._id });
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const cls = await withPdf({
      document: buildDocument({
        kind: 'routineClass', title, session, school,
        noticeNo: `${noticeNo}/${clsCode}`, publishedAt: prev?.document?.date || publishedAt,
        groups: [group], exams: groupExams,
      }),
      existing: prev,
      publicId: `exam_routine_${schoolId}_${campusId || 'x'}_${session?._id || 'x'}_${slug(title)}_${group._id}`,
      fileName: `${fileBase}-routine-${clsCode}.pdf`,
    });
    const classLbl = [classLabel(groupClassName(group)), groupSectionName(group)].filter(Boolean).join(' - ');
    // eslint-disable-next-line no-await-in-loop
    await upsertNotice(classKey, {
      ...baseNoticeFields({ schoolId, campusId, createdBy, kind }),
      title: `Exam Routine Published: ${title} – ${classLbl}`,
      message: noticeToText(cls.document),
      document: cls.document,
      ...(cls.attachments ? { attachments: cls.attachments } : {}),
      audience: 'All',
      targetRole: 'all',
      // Exactly this class's students and their linked parents.
      targetUserIds: recipients,
      classId: group.classId?._id || group.classId || null,
      sectionId: group.sectionId?._id || group.sectionId || null,
      className: groupClassName(group),
      sectionName: groupSectionName(group),
      adminHidden: true,
      typeLabel: 'exam_notice_routine_class',
      relatedEntity: { entityType: 'examGroup', entityId: group._id },
    }, prev?._id);
  }
  // Classes no longer published → remove their copies.
  await Notification.deleteMany({
    dedupeKey: { $regex: `^${classKeyPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $nin: liveKeys },
  });

  // The routine supersedes the "scheduled" notice — keep that as a record, unpinned.
  await Notification.updateOne(
    { dedupeKey: noticeKeyFor({ kind: 'scheduled', schoolId, campusId, sessionId: session?._id, title }) },
    { $set: { isPinned: false } },
  );
  return saved;
};

/**
 * Debounced entry point used by the exam routes. Many calls for the same exam
 * within DEBOUNCE_MS collapse into one rebuild. Fire-and-forget.
 */
const scheduleExamNoticeRefresh = ({ kind, schoolId, campusId = null, title, sampleDate = null, createdBy = null }) => {
  if (!schoolId || !title || !['scheduled', 'routine'].includes(kind)) return;
  const key = `${kind}|${schoolId}|${campusId || ''}|${slug(title)}`;
  clearTimeout(timers.get(key));
  const tenant = getTenantContext();
  timers.set(key, setTimeout(() => {
    timers.delete(key);
    const run = () => refreshExamNotice({ kind, schoolId, campusId, title, sampleDate, createdBy })
      .catch((err) => console.error(`[exam-notice] ${kind} refresh failed:`, err.message));
    // Keep the tenant scope of the request that scheduled it.
    if (tenant?.organization || tenant?.organizationId) runWithTenant(tenant.organization || tenant, run);
    else run();
  }, DEBOUNCE_MS));
};

module.exports = { scheduleExamNoticeRefresh, refreshExamNotice, buildDocument };
