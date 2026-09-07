const express = require('express');
const request = require('supertest');

jest.mock('../middleware/authStudent', () => (req, _res, next) => {
  req.user = {
    id: '6a82b7d4c85ecdcb9a497656',
    schoolId: '69859a64fed654f01eae2b80',
    campusId: '69859a64fed654f01eae2b81',
  };
  req.userId = req.user.id;
  req.schoolId = req.user.schoolId;
  req.campusId = req.user.campusId;
  next();
});

jest.mock('../utils/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockStudentUser = { findById: jest.fn() };
const mockTeachingMaterial = { find: jest.fn(), countDocuments: jest.fn() };
const mockPracticePaper = { find: jest.fn(), countDocuments: jest.fn() };

jest.mock('../models/StudentUser', () => mockStudentUser);
jest.mock('../models/TeachingMaterial', () => mockTeachingMaterial);
jest.mock('../models/PracticePaper', () => mockPracticePaper);

const makePlacementQuery = () => {
  const query = {
    select: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue({ grade: '10', section: 'A' }),
  };
  return query;
};

const makeListQuery = () => {
  const query = {
    sort: jest.fn(() => query),
    skip: jest.fn(() => query),
    limit: jest.fn(() => query),
    select: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue([]),
  };
  return query;
};

const studentMaterialRoutes = require('../routes/studentMaterialRoutes');
const practicePaperRoutes = require('../routes/practicePaperRoutes');

describe('student learning resource placement queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStudentUser.findById.mockImplementation(() => makePlacementQuery());
    mockTeachingMaterial.find.mockImplementation(() => makeListQuery());
    mockTeachingMaterial.countDocuments.mockResolvedValue(0);
    mockPracticePaper.find.mockImplementation(() => makeListQuery());
    mockPracticePaper.countDocuments.mockResolvedValue(0);
  });

  test.each([
    ['/student/materials', 'materials'],
    ['/practice-papers/student/papers', 'papers'],
  ])('%s excludes encrypted profile fields', async (path, responseKey) => {
    const app = express();
    app.use('/student/materials', studentMaterialRoutes);
    app.use('/practice-papers', practicePaperRoutes);

    const response = await request(app).get(path);

    expect(response.status).toBe(200);
    expect(response.body[responseKey]).toEqual([]);

    const studentQuery = mockStudentUser.findById.mock.results[0].value;
    expect(studentQuery.select).toHaveBeenCalledWith(
      'classId sectionId className sectionName grade section'
    );
    expect(studentQuery.select.mock.invocationCallOrder[0]).toBeLessThan(
      studentQuery.lean.mock.invocationCallOrder[0]
    );
  });
});
