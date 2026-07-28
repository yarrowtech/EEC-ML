const express = require('express');
const request = require('supertest');

const mockParentFindById = jest.fn();
const mockStudentFind = jest.fn();
const mockExcuseFind = jest.fn();

jest.mock('../middleware/authParent', () => (req, _res, next) => {
  req.user = { id: 'parent-1' };
  req.schoolId = 'school-1';
  req.campusId = 'campus-1';
  next();
});

jest.mock('../middleware/authStudent', () => (_req, _res, next) => next());
jest.mock('../middleware/authTeacher', () => (_req, _res, next) => next());

const makeQuery = (value) => {
  const query = {
    select: jest.fn(() => query),
    sort: jest.fn(() => query),
    lean: jest.fn(() => Promise.resolve(value)),
  };
  return query;
};

jest.mock('../models/ParentUser', () => ({
  findById: (...args) => mockParentFindById(...args),
}));
jest.mock('../models/StudentUser', () => ({
  find: (...args) => mockStudentFind(...args),
  findById: jest.fn(),
}));
jest.mock('../models/ExcuseLetter', () => ({
  find: (...args) => mockExcuseFind(...args),
  create: jest.fn(),
}));
jest.mock('../models/TeacherAllocation', () => ({ find: jest.fn() }));
jest.mock('../models/Class', () => ({ findOne: jest.fn() }));
jest.mock('../models/Section', () => ({ findOne: jest.fn() }));
jest.mock('../models/School', () => ({ findById: jest.fn() }));

const excuseLetterRoutes = require('../routes/excuseLetterRoutes');
const app = express();
app.use(express.json());
app.use('/api/excuse-letters', excuseLetterRoutes);

describe('parent excuse-letter authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParentFindById.mockReturnValue(makeQuery({
      schoolId: 'school-1',
      campusId: 'campus-1',
      childrenIds: ['child-1', 'child-2'],
      children: ['Legacy Name'],
    }));
    mockStudentFind.mockReturnValue(makeQuery([
      { _id: 'child-1' },
      { _id: 'child-2' },
    ]));
    mockExcuseFind.mockReturnValue(makeQuery([
      { _id: 'letter-1', studentId: 'child-1' },
    ]));
  });

  test('queries only letters belonging to the authenticated parent children', async () => {
    const response = await request(app)
      .get('/api/excuse-letters/parent')
      .query({ studentId: 'unlinked-child' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ _id: 'letter-1', studentId: 'child-1' }]);
    expect(mockParentFindById).toHaveBeenCalledWith('parent-1');
    expect(mockStudentFind).toHaveBeenCalledWith({
      schoolId: 'school-1',
      campusId: 'campus-1',
      _id: { $in: ['child-1', 'child-2'] },
    });
    expect(mockExcuseFind).toHaveBeenCalledWith({
      schoolId: 'school-1',
      campusId: 'campus-1',
      studentId: { $in: ['child-1', 'child-2'] },
    });
  });
});
