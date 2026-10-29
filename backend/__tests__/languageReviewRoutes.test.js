const express = require('express');
const request = require('supertest');
const mockQuery = (data) => ({ select: () => mockQuery(data), populate: () => mockQuery(data), sort: () => mockQuery(data), limit: () => mockQuery(data), lean: async () => data });
const mockContent = { findOne: jest.fn(), find: jest.fn() };
const mockAssessment = { find: jest.fn(), findOne: jest.fn() };
jest.mock('../models/ReadingMaterial', () => mockContent);
jest.mock('../models/WritingPrompt', () => mockContent);
jest.mock('../models/ReadingAssessment', () => mockAssessment);
jest.mock('../models/WritingAssessment', () => mockAssessment);
jest.mock('../middleware/authTeacher', () => (req, res, next) => { req.schoolId = 'school'; req.user = { id: 'teacher' }; next(); });
jest.mock('../middleware/authStudent', () => (req, res, next) => { req.schoolId = 'school'; req.userId = 'student'; next(); });
const id = '507f1f77bcf86cd799439011';
const app = express(); app.use(express.json());
app.use('/reading', require('../routes/readingAssessmentRoutes'));
app.use('/writing', require('../routes/writingAssessmentRoutes'));
beforeEach(() => { jest.clearAllMocks(); mockContent.findOne.mockReturnValue(mockQuery({ _id: id })); mockContent.find.mockReturnValue(mockQuery([{ _id: id }])); mockAssessment.find.mockReturnValue(mockQuery([])); mockAssessment.findOne.mockReturnValue(mockQuery({ _id: id, suggestions: ['Check tense'] })); });
describe.each([['reading', 'materialId'], ['writing', 'promptId']])('%s review boundaries', (mode, field) => {
  test('teacher review requires content ownership in the current school', async () => {
    expect((await request(app).get(`/${mode}/teacher/assessments/${id}`)).status).toBe(200);
    expect(mockContent.findOne).toHaveBeenCalledWith({ _id: id, schoolId: 'school', teacherId: 'teacher' });
    mockContent.findOne.mockReturnValue(mockQuery(null));
    mockAssessment.find.mockClear();
    expect((await request(app).get(`/${mode}/teacher/assessments/${id}`)).status).toBe(404);
    expect(mockAssessment.find).not.toHaveBeenCalled();
  });
  test('all assessments are limited to owned content and student feedback to self plus school', async () => {
    expect((await request(app).get(`/${mode}/teacher/all-assessments`)).status).toBe(200);
    expect(mockAssessment.find).toHaveBeenCalledWith({ schoolId: 'school', [field]: { $in: [id] } });
    const result = await request(app).get(`/${mode}/student/assessments/${id}`);
    expect(result.status).toBe(200);
    expect(result.body.data.suggestions).toEqual(['Check tense']);
    expect(mockAssessment.findOne).toHaveBeenCalledWith({ _id: id, studentId: 'student', schoolId: 'school' });
  });
});
