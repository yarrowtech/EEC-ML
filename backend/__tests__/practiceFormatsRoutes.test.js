const express = require('express');
const request = require('supertest');
const id = '507f1f77bcf86cd799439011';
const other = '507f1f77bcf86cd799439012';
const mockQuery = (data) => ({ select: () => mockQuery(data), sort: () => mockQuery(data), populate: () => mockQuery(data), lean: async () => data });
const mockQuestion = { find: jest.fn(), create: jest.fn() };
const mockAttempt = { insertMany: jest.fn() };
jest.mock('../models/PracticeQuestion', () => mockQuestion);
jest.mock('../models/PracticeAttempt', () => mockAttempt);
jest.mock('../models/StudentUser', () => ({ findOne: () => mockQuery({ grade: '5', section: 'A' }) }));
jest.mock('../models/Class', () => ({ findOne: () => mockQuery({ _id: id, name: '5' }) }));
jest.mock('../models/Section', () => ({ findOne: () => mockQuery({ _id: id, name: 'A' }) }));
jest.mock('../models/Subject', () => ({ findOne: () => mockQuery({ _id: id, classId: id }) }));
jest.mock('../models/TeacherAllocation', () => ({ findOne: () => mockQuery({ _id: id }) }));
jest.mock('../middleware/authStudent', () => (req, res, next) => { req.user = { id: 'student' }; req.schoolId = 'school'; next(); });
jest.mock('../middleware/authTeacher', () => (req, res, next) => { req.user = { id: 'teacher' }; req.schoolId = 'school'; next(); });
jest.mock('../utils/studentPortalLogger', () => ({ logStudentPortalEvent: jest.fn(), logStudentPortalError: jest.fn() }));
jest.mock('../services/errorClassifier', () => ({ recordErrors: jest.fn().mockResolvedValue([]) }));
const app = express(); app.use(express.json()); app.use('/practice', require('../routes/practiceRoutes'));
beforeEach(() => { jest.clearAllMocks(); mockAttempt.insertMany.mockResolvedValue([]); });
test('teacher creates a matching question; student receives no answer key', async () => {
  mockQuestion.create.mockImplementation(async (value) => ({ _id: id, ...value }));
  const result = await request(app).post('/practice/teacher/questions').send({ classId: id, sectionId: id, subjectId: id, type: 'matching', question: 'Match', matchingLeft: ['Sun', 'Earth'], correctAnswer: '["Star","Planet"]' });
  expect(result.status).toBe(201);
  mockQuestion.find.mockReturnValue(mockQuery([result.body.question]));
  const loaded = await request(app).get(`/practice/student/questions?subjectId=${id}&type=matching`);
  expect(loaded.status).toBe(200);
  expect(loaded.body.questions[0]).toEqual({ id, question: 'Match', type: 'matching', options: ['Planet', 'Star'], matchingLeft: ['Sun', 'Earth'] });
  expect(mockQuestion.find).toHaveBeenLastCalledWith(expect.objectContaining({ schoolId: 'school', classId: id, sectionId: id, isActive: true }));
});
test('scores and persists True/False and matching attempts', async () => {
  mockQuestion.find.mockReturnValue(mockQuery([
    { _id: id, type: 'true_false', correctAnswer: 'False', classId: id, sectionId: id, subjectId: id },
    { _id: other, type: 'matching', correctAnswer: '["Star","Planet"]', matchingLeft: ['Sun', 'Earth'], options: ['Planet', 'Star'], classId: id, sectionId: id, subjectId: id },
  ]));
  const result = await request(app).post('/practice/student/submit').send({ answers: [{ questionId: id, answer: 'False' }, { questionId: other, answer: '["Planet","Star"]' }] });
  expect(result.status).toBe(200);
  expect(result.body.correct).toBe(1);
  expect(mockAttempt.insertMany).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ studentId: 'student', schoolId: 'school', questionId: other, isCorrect: false })]));
});
test('unavailable or duplicate question IDs cannot write attempts', async () => {
  mockQuestion.find.mockReturnValue(mockQuery([]));
  expect((await request(app).post('/practice/student/submit').send({ answers: [{ questionId: id, answer: 'True' }] })).status).toBe(403);
  expect((await request(app).post('/practice/student/submit').send({ answers: [{ questionId: id }, { questionId: id }] })).status).toBe(400);
  expect(mockAttempt.insertMany).not.toHaveBeenCalled();
});
