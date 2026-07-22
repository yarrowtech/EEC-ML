const Notification = require('../models/Notification');
const School = require('../models/School');

const DAY_MS = 24 * 60 * 60 * 1000;

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
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dt);
};

const AUDIENCES = ['Student', 'Teacher', 'Parent'];

const COPY = {
  started: {
    Student: (endLabel) => ({
      title: 'Teacher Feedback is Open!',
      message: `The teacher feedback window is now open. Please share your honest feedback for each of your teachers before ${endLabel}.`,
    }),
    Teacher: (endLabel) => ({
      title: 'Student Feedback Collection Started',
      message: `Students can now submit feedback for you until ${endLabel}. You will be able to view your aggregated feedback as submissions come in.`,
    }),
    Parent: (endLabel) => ({
      title: 'Teacher Feedback Window is Open',
      message: `The school has opened the teacher feedback window, open until ${endLabel}. Please encourage your child to share honest feedback for their teachers.`,
    }),
  },
  closingSoon: {
    Student: (endLabel, daysLeft) => ({
      title: 'Teacher Feedback Closing Soon',
      message: `Only ${daysLeft} day${daysLeft === 1 ? '' : 's'} left to submit your feedback for your teachers. The window closes on ${endLabel}.`,
    }),
    Teacher: (endLabel, daysLeft) => ({
      title: 'Feedback Window Closing Soon',
      message: `The student feedback collection window closes on ${endLabel} (${daysLeft} day${daysLeft === 1 ? '' : 's'} left).`,
    }),
    Parent: (endLabel, daysLeft) => ({
      title: 'Teacher Feedback Closing Soon',
      message: `Only ${daysLeft} day${daysLeft === 1 ? '' : 's'} left for the teacher feedback window. Please remind your child to submit their feedback before ${endLabel}.`,
    }),
  },
  lastDay: {
    Student: (endLabel) => ({
      title: 'Last Day for Teacher Feedback!',
      message: `Today is the last day to submit your feedback for your teachers. Please complete it before the window closes on ${endLabel}.`,
    }),
    Teacher: (endLabel) => ({
      title: 'Feedback Window Closes Today',
      message: `Today, ${endLabel}, is the last day for students to submit feedback for you.`,
    }),
    Parent: (endLabel) => ({
      title: 'Last Day for Teacher Feedback!',
      message: `Today is the last day of the teacher feedback window. Please remind your child to submit their feedback before it closes on ${endLabel}.`,
    }),
  },
};

const createIfMissing = async ({ schoolId, audience, typeLabel, title, message, expiresAt, priority }) => {
  const existing = await Notification.findOne({ schoolId, campusId: null, typeLabel }).select('_id').lean();
  if (existing) return null;
  return Notification.create({
    schoolId,
    campusId: null,
    title,
    message,
    audience,
    type: 'general',
    typeLabel,
    priority,
    category: 'academic',
    createdByType: 'admin',
    createdByName: 'System',
    expiresAt: expiresAt || null,
  });
};

const notifyTeacherFeedbackWindowStarted = async ({ schoolId, startDate, endDate }) => {
  if (!schoolId || !startDate || !endDate) return { created: 0 };
  const endLabel = formatDateLabel(endDate);
  const key = `teacher_feedback_started:${dateKey(startDate)}:${dateKey(endDate)}`;

  let created = 0;
  for (const audience of AUDIENCES) {
    const copy = COPY.started[audience](endLabel);
    const doc = await createIfMissing({
      schoolId,
      audience,
      typeLabel: `${key}:${audience}`,
      title: copy.title,
      message: copy.message,
      expiresAt: endDate,
      priority: 'medium',
    });
    if (doc) created += 1;
  }
  return { created };
};

const CLOSING_SOON_DAYS_BEFORE = 3;

const dispatchTeacherFeedbackReminders = async () => {
  const todayUtc = toUtcDateStart(new Date());
  if (!todayUtc) return { scanned: 0, created: 0 };

  const schools = await School.find({
    'teacherFeedbackSettings.enabled': true,
    'teacherFeedbackSettings.endDate': { $gte: todayUtc },
  })
    .select('_id teacherFeedbackSettings')
    .lean();

  let created = 0;

  for (const school of schools) {
    const endDate = school.teacherFeedbackSettings?.endDate;
    const endUtc = toUtcDateStart(endDate);
    if (!endUtc) continue;

    const daysLeft = Math.round((endUtc.getTime() - todayUtc.getTime()) / DAY_MS);

    let stage = null;
    if (daysLeft === CLOSING_SOON_DAYS_BEFORE) stage = 'closingSoon';
    else if (daysLeft === 0) stage = 'lastDay';
    if (!stage) continue;

    const endLabel = formatDateLabel(endDate);
    const key = stage === 'closingSoon'
      ? `teacher_feedback_closing_soon:${dateKey(endDate)}`
      : `teacher_feedback_last_day:${dateKey(endDate)}`;

    for (const audience of AUDIENCES) {
      const copy = COPY[stage][audience](endLabel, daysLeft);
      const doc = await createIfMissing({
        schoolId: school._id,
        audience,
        typeLabel: `${key}:${audience}`,
        title: copy.title,
        message: copy.message,
        expiresAt: endDate,
        priority: stage === 'lastDay' ? 'high' : 'medium',
      });
      if (doc) created += 1;
    }
  }

  return { scanned: schools.length, created };
};

module.exports = {
  notifyTeacherFeedbackWindowStarted,
  dispatchTeacherFeedbackReminders,
};
