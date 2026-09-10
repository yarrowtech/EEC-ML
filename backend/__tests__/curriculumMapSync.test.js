describe('curriculum map material synchronisation', () => {
  const calls = {};

  beforeEach(() => {
    jest.resetModules();
    calls.findOneAndUpdate = jest.fn(() => Promise.resolve({}));
    calls.findOne = jest.fn(() => ({ lean: () => Promise.resolve(calls.map) }));
    calls.updateOne = jest.fn(() => Promise.resolve({}));

    jest.doMock('../models/CurriculumMap', () => ({
      findOneAndUpdate: calls.findOneAndUpdate,
      findOne: calls.findOne,
      updateOne: calls.updateOne,
    }));
    jest.doMock('../middleware/authTeacher', () => (_req, _res, next) => next());
    jest.doMock('../models/TeachingMaterial', () => ({}));
    jest.doMock('../models/TeacherUser', () => ({}));
    jest.doMock('../models/Class', () => ({}));
    jest.doMock('../models/Section', () => ({}));
    jest.doMock('../models/Subject', () => ({}));
    jest.doMock('axios', () => ({}));
    jest.doMock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
  });

  test('scopes auto-added topics by section and matches titles case-insensitively', async () => {
    calls.map = { topics: [{ _id: 'topic-1', title: 'Fractions', learningOutcomes: ['add fractions'], concepts: ['fraction'] }] };
    const router = require('../routes/teachingMaterialRoutes');

    await router.updateCurriculumMapFromMaterial({
      schoolId: 'school-1', subjectName: 'Math', className: '5', sectionName: 'B', topicTitle: ' fractions ', teacherId: 'teacher-1',
    }, { learningOutcomes: ['compare fractions'], concepts: ['numerator'] });

    expect(calls.findOneAndUpdate).toHaveBeenCalledWith(
      { schoolId: 'school-1', subject: 'Math', className: '5', section: 'B' },
      { $setOnInsert: { createdBy: 'teacher-1', topics: [] } },
      { upsert: true },
    );
    expect(calls.findOne).toHaveBeenCalledWith({ schoolId: 'school-1', subject: 'Math', className: '5', section: 'B' });
    expect(calls.updateOne).toHaveBeenCalledWith(
      { schoolId: 'school-1', subject: 'Math', className: '5', section: 'B', 'topics._id': 'topic-1' },
      { $set: { 'topics.$.learningOutcomes': ['add fractions', 'compare fractions'], 'topics.$.concepts': ['fraction', 'numerator'] } },
    );
  });

  test('creates a topic in the detected section when no topic exists', async () => {
    calls.map = { topics: [] };
    const router = require('../routes/teachingMaterialRoutes');

    await router.updateCurriculumMapFromMaterial({
      schoolId: 'school-1', subjectName: 'Science', className: '6', sectionName: '', topicTitle: 'Cells', teacherId: 'teacher-1',
    });

    expect(calls.updateOne).toHaveBeenCalledWith(
      { schoolId: 'school-1', subject: 'Science', className: '6', section: '' },
      { $push: { topics: expect.objectContaining({ order: 1, title: 'Cells' }) } },
    );
  });
});
