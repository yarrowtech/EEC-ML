const express = require('express');
const request = require('supertest');

const SCHOOL_ID = '69859a64fed654f01eae2b80';
const CAMPUS_ID = '69859a64fed654f01eae2b81';
const STUDENT_ID = '6a82b7d4c85ecdcb9a497656';
const CLASS_ID = '6a5f19f752875bb554d17980';
const SECTION_ID = '6a5f19f852875bb554d1798c';

jest.mock('../middleware/authStudent', () => (req, _res, next) => {
  req.user = { id: STUDENT_ID, schoolId: SCHOOL_ID, campusId: CAMPUS_ID };
  req.schoolId = SCHOOL_ID;
  req.campusId = CAMPUS_ID;
  next();
});

jest.mock('../utils/studentPortalLogger', () => ({
  logStudentPortalEvent: jest.fn(),
  logStudentPortalError: jest.fn(),
}));

const mockStudentUser = { findOne: jest.fn() };
const mockLessonPlan = { find: jest.fn() };
const mockTeachingMaterial = { find: jest.fn() };
const mockPracticePaper = { find: jest.fn() };
const mockAssignment = { find: jest.fn() };

jest.mock('../models/StudentUser', () => mockStudentUser);
jest.mock('../models/LessonPlan', () => mockLessonPlan);
jest.mock('../models/TeachingMaterial', () => mockTeachingMaterial);
jest.mock('../models/PracticePaper', () => mockPracticePaper);
jest.mock('../models/Assignment', () => mockAssignment);

const sortedQuery = (value) => ({
  sort: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(value) })),
});

const lessonPlanRoutes = require('../routes/lessonPlanRoutes');

describe('student smart-learning map', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const studentQuery = {
      select: jest.fn(() => studentQuery),
      lean: jest.fn().mockResolvedValue({ classId: CLASS_ID, sectionId: SECTION_ID }),
    };
    mockStudentUser.findOne.mockReturnValue(studentQuery);
    mockLessonPlan.find.mockReturnValue(sortedQuery([]));
    mockTeachingMaterial.find.mockImplementation(() => sortedQuery([]));
    mockPracticePaper.find.mockReturnValue(sortedQuery([]));
    mockAssignment.find.mockReturnValue(sortedQuery([]));
  });

  test('loads only placement fields and does not hydrate encrypted student PII', async () => {
    const app = express();
    app.use('/lesson-plans', lessonPlanRoutes);

    const response = await request(app).get('/lesson-plans/student/smart-learning-map');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ subjects: [] });

    const studentQuery = mockStudentUser.findOne.mock.results[0].value;
    expect(studentQuery.select).toHaveBeenCalledWith('classId sectionId grade section');
    expect(studentQuery.select.mock.invocationCallOrder[0]).toBeLessThan(
      studentQuery.lean.mock.invocationCallOrder[0]
    );
  });
});
