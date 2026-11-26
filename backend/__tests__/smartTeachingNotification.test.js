jest.mock('isomorphic-dompurify', () => ({ sanitize: (v) => v }));
const mockFindOne = jest.fn();
const mockCreate = jest.fn();
jest.mock('../models/Notification', () => ({
  findOne: (...a) => mockFindOne(...a),
  create: (...a) => mockCreate(...a),
}));

const { createPublishedStudentNotification } = require('../routes/lessonPlanRoutes').__test;

const plan = {
  _id: 'plan1', subject: 'Computer', classId: 'class5', sectionId: 'secA',
  className: '5', sectionName: 'A', subjectId: 'sub1', teacherId: 't1', teacherName: 'Koushik',
};
const args = { schoolId: 'school1', campusId: null, plan, chapterTitle: 'Basics', topicTitle: 'Basics', subTopicTitle: 'Overview' };
const found = (doc) => ({ select: () => ({ lean: () => Promise.resolve(doc) }) });

beforeEach(() => { mockFindOne.mockReset(); mockCreate.mockReset(); });

test('first publish creates one notice for that class + section only', async () => {
  mockFindOne.mockReturnValue(found(null));
  await createPublishedStudentNotification(args);
  expect(mockCreate).toHaveBeenCalledTimes(1);
  const doc = mockCreate.mock.calls[0][0];
  expect(doc).toMatchObject({ audience: 'Student', classId: 'class5', sectionId: 'secA', className: '5', sectionName: 'A' });
  expect(doc.dedupeKey).toBe('smart-teaching:school1:plan1:basics:basics:overview');
});

test('re-publishing / editing the same chapter does not create another notice', async () => {
  mockFindOne.mockReturnValue(found({ _id: 'n1' }));
  await createPublishedStudentNotification(args);
  await createPublishedStudentNotification(args);
  expect(mockCreate).not.toHaveBeenCalled();
  // also matches older notices saved before the dedupe key existed
  const query = mockFindOne.mock.calls[0][0];
  expect(query.$or).toEqual(expect.arrayContaining([
    { dedupeKey: 'smart-teaching:school1:plan1:basics:basics:overview' },
    expect.objectContaining({ classId: 'class5', sectionId: 'secA', title: 'New Smart Teaching content published' }),
  ]));
});

test('a parallel publish racing on the unique key is ignored', async () => {
  mockFindOne.mockReturnValue(found(null));
  mockCreate.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
  await expect(createPublishedStudentNotification(args)).resolves.toBeUndefined();
});
