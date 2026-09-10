/**
 * Teacher override of AI tutor answers. The correction is stored in its own
 * collection (survives the student's chat re-sync), scoped to the teacher's
 * allocations, must target an assistant message, and is audited.
 */
const express = require('express');
const request = require('supertest');

const queryLean = (value) => ({
  select: () => ({ lean: () => Promise.resolve(value) }),
  sort: () => queryLean(value),
  limit: () => queryLean(value),
  lean: () => Promise.resolve(value),
});

describe('AI tutor answer correction', () => {
  let app;
  let mocks;

  const CONV_ID = '507f1f77bcf86cd799439a11';
  const CONV = {
    _id: CONV_ID, clientId: 'c-1', studentId: 'stud1', schoolId: 'school1',
    messages: [
      { id: 'm1', role: 'user', text: 'what is 2+2?' },
      { id: 'm2', role: 'assistant', text: '2 + 2 = 5' },
    ],
  };

  beforeEach(() => {
    jest.resetModules();
    mocks = {
      conversation: { ...CONV, messages: CONV.messages.map((m) => ({ ...m })) },
      student: { _id: 'stud1', name: 'Ada', grade: '5', section: 'A' },
      scopeInclusive: true,
      correctionUpsert: null,
    };

    jest.doMock('axios', () => ({ post: jest.fn(), get: jest.fn() }));
    jest.doMock('../middleware/authStudent', () => (req, _res, next) => { req.schoolId = 'school1'; req.user = { id: 'stud1' }; next(); });
    jest.doMock('../middleware/authTeacher', () => (req, _res, next) => {
      req.schoolId = 'school1'; req.user = { id: 'teacher1' }; req.teacher = { id: 'teacher1' }; next();
    });
    jest.doMock('../models/TeachingMaterial', () => ({}));
    jest.doMock('../models/LessonPlan', () => ({}));
    jest.doMock('../models/StudentProgress', () => ({}));
    jest.doMock('../utils/studentContextBuilder', () => ({ buildStudentContext: jest.fn() }));
    jest.doMock('../utils/teachingMaterialAccess', () => ({ partitionMaterialsByEnabled: jest.fn(() => ({ enabled: [], disabledIds: [] })) }));

    jest.doMock('../utils/teacherAllocationScope', () => {
      const actual = jest.requireActual('../utils/teacherAllocationScope');
      return { ...actual, buildTeacherAllocationScope: jest.fn(() => Promise.resolve([{ normalizedClass: '5', normalizedSection: 'a' }])) };
    });

    jest.doMock('../models/TutorConversation', () => ({ findOne: jest.fn(() => queryLean(mocks.conversation)) }));
    jest.doMock('../models/StudentUser', () => ({
      findOne: jest.fn(() => queryLean(mocks.scopeInclusive ? mocks.student : { ...mocks.student, grade: '9', section: 'Z' })),
      find: jest.fn(() => queryLean([mocks.student])),
    }));
    jest.doMock('../models/TeacherUser', () => ({ findOne: jest.fn(() => queryLean({ _id: 'teacher1', name: 'Mr Byte' })) }));
    jest.doMock('../models/AuditLog', () => ({ create: jest.fn(() => Promise.resolve({})) }));
    jest.doMock('../models/TutorAnswerCorrection', () => ({
      findOneAndUpdate: jest.fn((filter, update) => {
        mocks.correctionUpsert = { filter, update };
        return Promise.resolve({ _id: 'corr1', ...update.$set });
      }),
      findOne: jest.fn(() => queryLean({ _id: 'corr1', conversationId: CONV_ID, schoolId: 'school1', status: 'active' })),
      find: jest.fn(() => queryLean([{ _id: 'corr1', studentId: 'stud1', status: 'active', correctedText: 'x' }])),
    }));

    app = express();
    app.use(express.json());
    app.use('/api/ai-tutor', require('../routes/aiTutorRoutes'));
  });

  test('rejects an empty correctedText', async () => {
    const r = await request(app).post('/api/ai-tutor/teacher/correct-answer')
      .send({ conversationId: CONV_ID, messageId: 'm2', correctedText: '   ' });
    expect(r.status).toBe(400);
  });

  test('rejects when no message is addressed', async () => {
    const r = await request(app).post('/api/ai-tutor/teacher/correct-answer')
      .send({ conversationId: CONV_ID, correctedText: '2 + 2 = 4' });
    expect(r.status).toBe(400);
  });

  test('refuses to correct a student (user) message', async () => {
    const r = await request(app).post('/api/ai-tutor/teacher/correct-answer')
      .send({ conversationId: CONV_ID, messageId: 'm1', correctedText: 'nope' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/assistant message/i);
  });

  test('blocks a teacher outside the student allocation scope', async () => {
    mocks.scopeInclusive = false;
    const r = await request(app).post('/api/ai-tutor/teacher/correct-answer')
      .send({ conversationId: CONV_ID, messageId: 'm2', correctedText: '2 + 2 = 4' });
    expect(r.status).toBe(403);
  });

  test('saves a correction with an original-answer snapshot and audits it', async () => {
    const r = await request(app).post('/api/ai-tutor/teacher/correct-answer')
      .send({ conversationId: CONV_ID, messageId: 'm2', correctedText: '2 + 2 = 4', reason: 'arithmetic error' });
    expect(r.status).toBe(200);
    expect(mocks.correctionUpsert.filter).toEqual({ conversationId: CONV_ID, messageId: 'm2' });
    expect(mocks.correctionUpsert.update.$set.originalText).toBe('2 + 2 = 5');
    expect(mocks.correctionUpsert.update.$set.correctedText).toBe('2 + 2 = 4');
    expect(mocks.correctionUpsert.update.$set.teacherName).toBe('Mr Byte');
    expect(require('../models/AuditLog').create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ai_tutor.answer_correction' })
    );
  });

  test('404 when the conversation does not exist', async () => {
    mocks.conversation = null;
    const r = await request(app).post('/api/ai-tutor/teacher/correct-answer')
      .send({ conversationId: CONV_ID, messageId: 'm2', correctedText: 'x' });
    expect(r.status).toBe(404);
  });
});

describe('tutorCorrectionService.attachCorrections', () => {
  beforeEach(() => jest.resetModules());

  test('flags corrected messages and attaches the corrections list', async () => {
    jest.doMock('../models/TutorAnswerCorrection', () => ({
      find: () => ({ sort: () => ({ lean: () => Promise.resolve([
        { _id: 'c1', conversationId: 'conv1', messageId: 'm2', correctedText: '2+2=4', reason: 'fix', updatedAt: new Date('2026-01-01') },
      ]) }) }),
    }));
    const { attachCorrections } = require('../services/tutorCorrectionService');
    const conversations = [{ _id: 'conv1', messages: [{ id: 'm1', role: 'user', text: 'q' }, { id: 'm2', role: 'assistant', text: '2+2=5' }] }];
    await attachCorrections(conversations, 'school1');

    expect(conversations[0].corrections).toHaveLength(1);
    expect(conversations[0].messages[1].teacherCorrected).toBe(true);
    expect(conversations[0].messages[1].correctedText).toBe('2+2=4');
    expect(conversations[0].messages[0].teacherCorrected).toBeUndefined();
  });
});
