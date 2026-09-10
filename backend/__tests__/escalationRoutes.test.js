/**
 * Escalation routes — teacher scope on raise, role-based list visibility,
 * acknowledge / resolve permissions.
 */
const express = require('express');
const request = require('supertest');

const chain = (v) => {
  const c = { select: () => c, sort: () => c, limit: () => c, lean: () => Promise.resolve(v), then: (r, j) => Promise.resolve(v).then(r, j) };
  return c;
};

describe('escalation routes', () => {
  let app, state;
  const CASE_ID = '507f1f77bcf86cd799439c11';
  const STUD_ID = '507f1f77bcf86cd799439c22';

  beforeEach(() => {
    jest.resetModules();
    state = {
      role: 'principal', actorId: 'p1',
      student: { _id: STUD_ID, name: 'Sam', grade: '5', section: 'A' },
      inScope: true,
      caseDoc: null,
      listResult: [{ _id: CASE_ID, status: 'open', severity: 'critical', studentId: STUD_ID }],
    };

    jest.doMock('../middleware/authAnyUser', () => (req, _res, next) => {
      req.schoolId = 'school1'; req.userType = state.role; req.user = { id: state.actorId, name: 'Actor' }; next();
    });
    jest.doMock('../middleware/authTeacher', () => (req, _res, next) => {
      req.schoolId = 'school1'; req.user = { id: 'teacher1', name: 'T' }; req.userType = state.role; next();
    });
    jest.doMock('../models/StudentUser', () => ({ findOne: () => chain(state.student) }));
    jest.doMock('../utils/teacherAllocationScope', () => {
      const actual = jest.requireActual('../utils/teacherAllocationScope');
      return { ...actual, buildTeacherAllocationScope: jest.fn(() => Promise.resolve(
        state.inScope ? [{ normalizedClass: '5', normalizedSection: 'a' }] : []
      )) };
    });
    jest.doMock('../services/escalationService', () => ({
      raiseEscalation: jest.fn(() => Promise.resolve({ case: { _id: CASE_ID }, created: true })),
    }));
    jest.doMock('../models/EscalationCase', () => ({
      find: jest.fn(() => chain(state.listResult)),
      findOne: jest.fn(() => Promise.resolve(state.caseDoc)),
    }));
    jest.doMock('../models/AuditLog', () => ({ create: jest.fn(() => Promise.resolve({})) }));

    app = express();
    app.use(express.json());
    app.use('/api/escalations', require('../routes/escalationRoutes'));
  });

  test('teacher cannot raise for a student outside their scope', async () => {
    state.role = 'teacher';
    state.inScope = false;
    const r = await request(app).post('/api/escalations')
      .send({ studentId: STUD_ID, category: 'wellbeing', severity: 'high', summary: 'worried' });
    expect(r.status).toBe(403);
  });

  test('teacher raises within scope', async () => {
    state.role = 'teacher';
    const r = await request(app).post('/api/escalations')
      .send({ studentId: STUD_ID, category: 'safeguarding', severity: 'critical', summary: 'disclosure' });
    expect(r.status).toBe(201);
    expect(require('../services/escalationService').raiseEscalation).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'safeguarding', auto: false })
    );
  });

  test('raise rejects an unknown category', async () => {
    state.role = 'teacher';
    const r = await request(app).post('/api/escalations').send({ studentId: STUD_ID, category: 'nonsense' });
    expect(r.status).toBe(400);
  });

  test('a principal sees all cases (no per-user filter)', async () => {
    let captured;
    jest.doMock('../models/EscalationCase', () => ({
      find: jest.fn((f) => { captured = f; return chain(state.listResult); }),
      findOne: jest.fn(),
    }));
    jest.resetModules();
    // rebuild app with the capturing mock
    const app2 = express();
    app2.use(express.json());
    jest.doMock('../middleware/authAnyUser', () => (req, _res, next) => { req.schoolId = 'school1'; req.userType = 'principal'; req.user = { id: 'p1' }; next(); });
    app2.use('/api/escalations', require('../routes/escalationRoutes'));
    const r = await request(app2).get('/api/escalations');
    expect(r.status).toBe(200);
    expect(captured.$or).toBeUndefined();
  });

  test('a counsellor only sees cases assigned to or raised by them', async () => {
    state.role = 'staff';
    state.actorId = 's1';
    let captured;
    jest.resetModules();
    jest.doMock('../middleware/authAnyUser', () => (req, _res, next) => { req.schoolId = 'school1'; req.userType = 'staff'; req.user = { id: 's1' }; next(); });
    jest.doMock('../models/EscalationCase', () => ({ find: jest.fn((f) => { captured = f; return chain([]); }), findOne: jest.fn() }));
    const appC = express();
    appC.use(express.json());
    appC.use('/api/escalations', require('../routes/escalationRoutes'));
    const r = await request(appC).get('/api/escalations');
    expect(r.status).toBe(200);
    expect(captured.$or).toEqual([{ 'assignedTo.userId': 's1' }, { 'raisedBy.id': 's1' }]);
  });
});
