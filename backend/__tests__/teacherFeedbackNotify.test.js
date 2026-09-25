const lean = (value) => ({ select: () => ({ lean: () => Promise.resolve(value) }), lean: () => Promise.resolve(value) });

jest.mock('../utils/withSchoolTenant', () => ({ withSchoolTenant: (_id, fn) => fn() }));
jest.mock('../models/Notification', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(() => Promise.resolve({})),
  updateOne: jest.fn(() => Promise.resolve({})),
  updateMany: jest.fn(() => Promise.resolve({})),
  deleteMany: jest.fn(() => Promise.resolve({})),
}));
jest.mock('../models/School', () => ({ findById: jest.fn(), find: jest.fn(), updateOne: jest.fn(() => Promise.resolve({ modifiedCount: 1 })) }));
jest.mock('../models/AcademicYear', () => ({ findById: jest.fn() }));
jest.mock('../models/NoticeCounter', () => ({ findOneAndUpdate: jest.fn(() => Promise.resolve({ seq: 1 })) }));
jest.mock('../utils/formalNoticePdf', () => ({ renderFormalNoticePdf: jest.fn(() => Promise.resolve(Buffer.from('pdf'))) }));
jest.mock('../utils/cloudinaryUpload', () => ({ uploadBufferToCloudinary: jest.fn(() => Promise.resolve({ secure_url: 'https://cdn/notice.pdf' })) }));
jest.mock('../models/StudentUser', () => ({ find: jest.fn() }));
jest.mock('../models/TeacherFeedback', () => ({ find: jest.fn() }));
jest.mock('../routes/studentRoute', () => ({
  feedbackHelpers: {
    buildTeacherFeedbackContext: jest.fn(() => Promise.resolve({
      contexts: [
        { teacherId: 't1', subjectId: 's1', subjectName: 'Maths' },
        { teacherId: 't2', subjectId: 's2', subjectName: 'English' },
      ],
    })),
  },
}));
jest.mock('../services/communicationService', () => ({
  EVENTS: {
    FEEDBACK_WINDOW_OPENED: 'FEEDBACK_WINDOW_OPENED',
    FEEDBACK_WINDOW_UPDATED: 'FEEDBACK_WINDOW_UPDATED',
    FEEDBACK_WINDOW_CLOSED: 'FEEDBACK_WINDOW_CLOSED',
    FEEDBACK_WINDOW_REMINDER: 'FEEDBACK_WINDOW_REMINDER',
  },
  broadcast: jest.fn(() => Promise.resolve({ created: 1, skipped: 0 })),
  notify: jest.fn(() => Promise.resolve({ created: 2, skipped: 0 })),
}));

const Notification = require('../models/Notification');
const School = require('../models/School');
const AcademicYear = require('../models/AcademicYear');
const StudentUser = require('../models/StudentUser');
const TeacherFeedback = require('../models/TeacherFeedback');
const { broadcast, notify } = require('../services/communicationService');
const { handleFeedbackWindowChange, dispatchTeacherFeedbackReminders } = require('../utils/teacherFeedbackNotify');

const schoolId = '64b000000000000000000001';
const sessionId = '64b000000000000000000002';
const window = (enabled, start, end) => ({ enabled, startDate: new Date(start), endDate: new Date(end) });
// Windows store end dates as end-of-day (23:59:59.999 UTC).
const daysFromToday = (n) => {
  const d = new Date();
  d.setUTCHours(23, 59, 59, 999);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

beforeEach(() => {
  jest.clearAllMocks();
  Notification.find.mockReturnValue(lean([]));
  School.findById.mockReturnValue(lean({ name: 'Kelomal Santoshini High School', address: 'Barasat, West Bengal' }));
  AcademicYear.findById.mockReturnValue(lean({ name: '2026-2027' }));
});

describe('handleFeedbackWindowChange', () => {
  it('opening creates formal student + parent notices and student/parent/teacher alerts', async () => {
    await handleFeedbackWindowChange({ schoolId, sessionId, before: null, after: window(true, '2026-10-01', '2026-10-15') });

    const notices = Notification.create.mock.calls.map(([doc]) => doc);
    expect(notices.map((n) => n.audience)).toEqual(['Student', 'Parent']);
    notices.forEach((n) => {
      expect(n.kind).toBe('notice');
      expect(n.document.noticeNo).toBe('KSHS/2026-27/FB/001');
      expect(n.document.subject).toBe('STUDENT FEEDBACK WINDOW – 2026–2027');
      expect(n.document.details.map((d) => d.label)).toEqual(['Academic Session', 'Feedback Opens', 'Feedback Closes']);
      expect(n.message).not.toMatch(/Status/);
      expect(n.isPinned).toBe(true);
      expect(n.expiresAt).toBeUndefined();
    });
    expect(notices[0].document.salutation).toBe('Dear Student,');
    expect(notices[1].document.salutation).toBe('Dear Parent/Guardian,');
    expect(notices[1].document.sections[0].title).toBe('For Parents/Guardians:');
    expect(notices[0].attachments[0]).toMatchObject({ name: 'Notice-KSHS-2026-27-FB-001-Student.pdf', url: 'https://cdn/notice.pdf', type: 'application/pdf' });
    expect(notices[1].attachments[0].name).toBe('Notice-KSHS-2026-27-FB-001-Parent.pdf');

    const alerts = broadcast.mock.calls.map(([arg]) => arg);
    expect(alerts.map((a) => a.audience)).toEqual(['Student', 'Parent', 'Teacher']);
    alerts.forEach((a) => expect(a.eventType).toBe('FEEDBACK_WINDOW_OPENED'));
  });

  it('re-saving with new dates keeps the same notice number', async () => {
    Notification.find.mockReturnValue(lean([
      { _id: 'n1', dedupeKey: `feedback-notice:${schoolId}:${sessionId}:Student`, document: { noticeNo: 'KSHS/2026-27/FB/007', date: '2026-10-01' } },
      { _id: 'n2', dedupeKey: `feedback-notice:${schoolId}:${sessionId}:Parent`, document: { noticeNo: 'KSHS/2026-27/FB/007', date: '2026-10-01' } },
    ]));
    await handleFeedbackWindowChange({
      schoolId, sessionId,
      before: window(true, '2026-10-01', '2026-10-10'),
      after: window(true, '2026-10-01', '2026-10-15'),
    });
    const updates = Notification.updateOne.mock.calls.map(([, op]) => op.$set);
    expect(updates).toHaveLength(2);
    updates.forEach((u) => expect(u.document.noticeNo).toBe('KSHS/2026-27/FB/007'));
    expect(broadcast.mock.calls.map(([a]) => a.eventType)).toEqual(Array(3).fill('FEEDBACK_WINDOW_UPDATED'));
  });

  it('saving an unchanged open window sends nothing', async () => {
    const w = window(true, '2026-10-01', '2026-10-10');
    const res = await handleFeedbackWindowChange({ schoolId, sessionId, before: w, after: { ...w } });
    expect(res.unchanged).toBe(true);
    expect(broadcast).not.toHaveBeenCalled();
    expect(Notification.create).not.toHaveBeenCalled();
  });

  it('disabling removes notices and sends CLOSED alerts', async () => {
    await handleFeedbackWindowChange({
      schoolId, sessionId,
      before: window(true, '2026-10-01', '2026-10-10'),
      after: { enabled: false, startDate: null, endDate: null },
    });
    expect(Notification.deleteMany).toHaveBeenCalled();
    expect(broadcast.mock.calls.map(([a]) => a.eventType)).toEqual(Array(3).fill('FEEDBACK_WINDOW_CLOSED'));
  });
});

describe('dispatchTeacherFeedbackReminders', () => {
  const setupSchool = (endInDays) => {
    School.find.mockReturnValue(lean([{
      _id: schoolId,
      teacherFeedbackWindows: [{ sessionId, enabled: true, startDate: daysFromToday(-5), endDate: daysFromToday(endInDays) }],
    }]));
    StudentUser.find.mockReturnValue(lean([
      { _id: 'st-done', name: 'Asha', grade: '5', section: 'A', schoolId },
      { _id: 'st-pending', name: 'Rahul', grade: '5', section: 'A', schoolId },
    ]));
    TeacherFeedback.find.mockReturnValue(lean([
      { studentId: 'st-done', teacherId: 't1', subjectId: 's1', subjectName: 'Maths' },
      { studentId: 'st-done', teacherId: 't2', subjectId: 's2', subjectName: 'English' },
      { studentId: 'st-pending', teacherId: 't1', subjectId: 's1', subjectName: 'Maths' },
    ]));
  };

  it('reminds only students with pending teachers (and their parents) when closing soon', async () => {
    setupSchool(2);
    await dispatchTeacherFeedbackReminders();

    expect(notify).toHaveBeenCalledTimes(1);
    const opts = notify.mock.calls[0][0];
    expect(opts.target.studentIds).toEqual(['st-pending']);
    expect(opts.student().title).toBe('Feedback Closing Soon');
    const parent = opts.parent({ _id: 'st-pending', name: 'Rahul' });
    expect(parent.message).toContain('Rahul has not yet given feedback for 1 teacher');
    expect(broadcast.mock.calls[0][0].audience).toBe('Teacher');
  });

  it('sends last-day reminders on the closing date', async () => {
    setupSchool(0);
    await dispatchTeacherFeedbackReminders();
    expect(notify.mock.calls[0][0].student().title).toBe('Last Day for Feedback!');
  });

  it('does nothing when more than 3 days remain', async () => {
    setupSchool(6);
    await dispatchTeacherFeedbackReminders();
    expect(notify).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalled();
  });
});

describe('autoCloseExpiredWindows', () => {
  const { autoCloseExpiredWindows } = require('../utils/teacherFeedbackNotify');

  it('switches an expired window off, unpins its notices and sends closed alerts', async () => {
    School.find.mockReturnValue(lean([{
      _id: schoolId,
      teacherFeedbackWindows: [{ sessionId, enabled: true, startDate: daysFromToday(-10), endDate: daysFromToday(-1) }],
    }]));
    const closed = await autoCloseExpiredWindows();

    expect(closed).toBe(1);
    expect(School.updateOne.mock.calls[0][1]).toEqual({ $set: { 'teacherFeedbackWindows.$[w].enabled': false } });
    const [filter, update] = Notification.updateMany.mock.calls[0];
    expect(filter.dedupeKey.$in).toHaveLength(2);
    expect(update).toEqual({ $set: { isPinned: false }, $unset: { expiresAt: '' } });
    expect(Notification.deleteMany).not.toHaveBeenCalled();
    const alerts = broadcast.mock.calls.map(([a]) => a);
    expect(alerts.map((a) => a.audience)).toEqual(['Student', 'Parent', 'Teacher']);
    expect(alerts[0].title).toBe('Feedback Portal Closed');
  });

  it('leaves a window alone until its last day has passed', async () => {
    School.find.mockReturnValue(lean([{
      _id: schoolId,
      teacherFeedbackWindows: [{ sessionId, enabled: true, startDate: daysFromToday(-10), endDate: daysFromToday(0) }],
    }]));
    expect(await autoCloseExpiredWindows()).toBe(0);
    expect(School.updateOne).not.toHaveBeenCalled();
  });

  it('does not re-alert when another run already closed it', async () => {
    School.find.mockReturnValue(lean([{
      _id: schoolId,
      teacherFeedbackWindows: [{ sessionId, enabled: true, startDate: daysFromToday(-10), endDate: daysFromToday(-1) }],
    }]));
    School.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
    expect(await autoCloseExpiredWindows()).toBe(0);
    expect(broadcast).not.toHaveBeenCalled();
  });
});
