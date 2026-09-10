/**
 * Long-answer assessment routes — teacher targeting scope, publish gate,
 * student submit → evaluate → persist, duplicate guard, and teacher review.
 */
const express = require('express');
const request = require('supertest');

const q = (v) => {
  const c = { select: () => c, sort: () => c, limit: () => c, lean: () => Promise.resolve(v), then: (r, j) => Promise.resolve(v).then(r, j) };
  return c;
};

describe('long-answer assessment routes', () => {
  let app, state;
  const QID = '507f1f77bcf86cd799439b11';
  const SID = '507f1f77bcf86cd799439b22';

  beforeEach(() => {
    jest.resetModules();
    state = {
      scopeAllows: true,
      question: { _id: QID, schoolId: 'school1', createdBy: 'teacher1', grade: '5', section: 'A', subject: 'Science',
        status: 'published', maxMarks: 10, questionText: 'Explain X', modelAnswer: 'X is...', toObject() { return { ...this }; }, save: jest.fn() },
      student: { _id: SID, name: 'Ada', grade: '5', section: 'A' },
      existingSubmission: null,
      savedSubmission: null,
    };

    jest.doMock('../middleware/authTeacher', () => (req, _res, next) => { req.schoolId = 'school1'; req.user = { id: 'teacher1' }; next(); });
    jest.doMock('../middleware/authStudent', () => (req, _res, next) => { req.schoolId = 'school1'; req.user = { id: SID }; next(); });

    jest.doMock('../utils/teacherAllocationScope', () => {
      const actual = jest.requireActual('../utils/teacherAllocationScope');
      return {
        ...actual,
        buildTeacherAllocationScope: jest.fn(() => Promise.resolve([{ normalizedClass: '5', normalizedSection: 'a', subjects: ['Science'], isClassTeacher: true }])),
        scopeAllowsRequest: jest.fn(() => state.scopeAllows),
      };
    });

    jest.doMock('../models/StudentUser', () => ({ findOne: () => q(state.student) }));
    jest.doMock('../models/TeacherUser', () => ({ findOne: () => q({ _id: 'teacher1', name: 'Mr B' }) }));
    jest.doMock('../models/AuditLog', () => ({ create: jest.fn(() => Promise.resolve({})) }));
    jest.doMock('../models/GeneratedQuestion', () => ({ findOne: () => q(null) }));

    jest.doMock('../models/LongAnswerQuestion', () => ({
      create: jest.fn((doc) => Promise.resolve({ _id: QID, ...doc })),
      findOne: jest.fn(() => q(state.question)),
      find: () => q([state.question]),
    }));
    jest.doMock('../models/LongAnswerSubmission', () => ({
      findOne: jest.fn(() => q(state.existingSubmission)),
      findOneAndUpdate: jest.fn((filter, update) => {
        state.savedSubmission = { _id: 'sub1', ...update.$set, toObject() { return { ...this }; } };
        return Promise.resolve(state.savedSubmission);
      }),
      updateOne: jest.fn(() => Promise.resolve({})),
      find: () => q([]),
      aggregate: () => Promise.resolve([]),
    }));

    jest.doMock('../services/longAnswerAssessmentService', () => {
      const actual = jest.requireActual('../services/longAnswerAssessmentService');
      return {
        ...actual,
        evaluateAnswer: jest.fn(() => Promise.resolve({
          score: 0.8, marks: 8, feedback: 'Solid.', errorType: '', bloomLevel: 'understand',
          missingConcepts: [], confidenceScore: 0.9, evaluationMethod: 'llm', evaluatorVersion: 'academic-v1', needsReview: false,
        })),
        applyMastery: jest.fn(() => Promise.resolve(true)),
      };
    });
    jest.doMock('../services/errorClassifier', () => ({ recordErrors: jest.fn(() => Promise.resolve()) }));
    jest.doMock('../utils/logger', () => ({ logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));

    app = express();
    app.use(express.json());
    app.use('/api/la', require('../routes/longAnswerAssessmentRoutes'));
  });

  test('teacher create is blocked when not allocated to the class/subject', async () => {
    state.scopeAllows = false;
    const r = await request(app).post('/api/la/teacher/questions')
      .send({ grade: '5', section: 'A', subject: 'Science', questionText: 'Explain photosynthesis in detail.' });
    expect(r.status).toBe(403);
  });

  test('teacher create succeeds as a draft', async () => {
    const r = await request(app).post('/api/la/teacher/questions')
      .send({ grade: '5', section: 'A', subject: 'Science', questionText: 'Explain photosynthesis in detail.' });
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe('draft');
  });

  test('student cannot submit to a draft question', async () => {
    state.question.status = 'draft';
    const r = await request(app).post(`/api/la/student/questions/${QID}/submit`).send({ answerText: 'A fairly long answer here.' });
    expect(r.status).toBe(409);
  });

  test('student submit evaluates, persists, and returns AI feedback', async () => {
    const r = await request(app).post(`/api/la/student/questions/${QID}/submit`).send({ answerText: 'Plants use light to make food and release oxygen.' });
    expect(r.status).toBe(201);
    expect(r.body.data.marks).toBe(8);
    expect(r.body.data.maxMarks).toBe(10);
    expect(require('../services/longAnswerAssessmentService').applyMastery).toHaveBeenCalled();
  });

  test('student cannot submit twice', async () => {
    state.existingSubmission = { _id: 'sub1', status: 'evaluated' };
    const r = await request(app).post(`/api/la/student/questions/${QID}/submit`).send({ answerText: 'Another attempt at the answer.' });
    expect(r.status).toBe(409);
  });

  test('a too-short answer is rejected', async () => {
    const r = await request(app).post(`/api/la/student/questions/${QID}/submit`).send({ answerText: 'no' });
    expect(r.status).toBe(400);
  });

  test('student submitting to another class is blocked', async () => {
    state.student = { _id: SID, name: 'Ada', grade: '9', section: 'Z' };
    const r = await request(app).post(`/api/la/student/questions/${QID}/submit`).send({ answerText: 'Trying to answer a question for another class.' });
    expect(r.status).toBe(403);
  });
});
