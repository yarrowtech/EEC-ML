/**
 * Regression: a class teacher whose Class doc is named "class 5" could not see
 * students (StudentUser.grade === "5") on the attendance sub-portal, because the
 * scope match compared the two raw strings. Fixed by routing the scope through
 * utils/teacherAllocationScope (allocation-aware + "class N" ↔ "N" normalised).
 */
const express = require('express');
const request = require('supertest');

const { normalizeClassName } = require('../utils/teacherAllocationScope');

let mockScope = [];
jest.mock('../utils/teacherAllocationScope', () => {
  const actual = jest.requireActual('../utils/teacherAllocationScope');
  return { ...actual, buildTeacherAllocationScope: jest.fn(() => Promise.resolve(mockScope)) };
});

const leanChain = (value) => {
  const chain = {
    select: () => chain,
    populate: () => chain,
    sort: () => chain,
    lean: () => Promise.resolve(value),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return chain;
};

let mockStudents = [];
jest.mock('../models/StudentUser', () => ({ find: () => leanChain(mockStudents), findOne: () => leanChain(null) }));
jest.mock('../models/AcademicYear', () => ({ findOne: () => leanChain({ name: '2026-2027' }) }));
jest.mock('../models/Timetable', () => ({ find: () => leanChain([]) }));
jest.mock('../models/Notification', () => ({}));
jest.mock('../models/ParentUser', () => ({}));
jest.mock('../models/TeacherUser', () => ({ findOne: () => leanChain(null), findById: () => leanChain(null) }));
jest.mock('../models/LessonPlan', () => ({ find: () => leanChain([]) }));
jest.mock('../models/LessonPlanCompletion', () => ({ find: () => leanChain([]) }));
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('../utils/studentPortalLogger', () => ({ logStudentPortalEvent: jest.fn(), logStudentPortalError: jest.fn() }));
jest.mock('../middleware/authStudent', () => (_req, _res, next) => next());
jest.mock('../middleware/authParent', () => (_req, _res, next) => next());
jest.mock('../middleware/adminAuth', () => (_req, _res, next) => next());
jest.mock('../middleware/authTeacher', () => (req, _res, next) => {
  req.user = { id: 'teacher-1', schoolId: 'school-1' };
  req.schoolId = 'school-1';
  req.campusId = null;
  next();
});

const attendanceRoutes = require('../routes/attendanceRoutes');
const app = express();
app.use(express.json());
app.use('/api/attendance', attendanceRoutes);

const student = (over) => ({
  _id: over.id,
  name: over.name,
  grade: over.grade,
  section: over.section,
  roll: over.roll ?? 1,
  attendance: [],
  ...over,
});

beforeEach(() => {
  mockScope = [];
  mockStudents = [];
});

describe('GET /api/attendance/teacher/students — class-name normalisation', () => {
  test('class teacher of "class 5" sees students stored as grade "5"', async () => {
    mockScope = [{ className: 'class 5', sectionName: 'B', normalizedClass: 'class 5'.replace(/^class\s+/, ''), normalizedSection: 'b', subjects: [], isClassTeacher: true }];
    // build normalizedClass via the real helper to mirror production
    mockScope[0].normalizedClass = normalizeClassName('class 5');
    mockStudents = [
      student({ id: 's1', name: 'Asha', grade: '5', section: 'B' }),
      student({ id: 's2', name: 'Ben', grade: '5', section: 'B' }),
      student({ id: 's3', name: 'Cara', grade: '6', section: 'A' }),
    ];

    const res = await request(app)
      .get('/api/attendance/teacher/students')
      .query({ className: 'Class 5', section: 'B', date: '2026-08-18' });

    expect(res.status).toBe(200);
    const names = res.body.students.map((s) => s.name).sort();
    expect(names).toEqual(['Asha', 'Ben']);
  });

  test('403 when the teacher has no class/section scope at all', async () => {
    mockScope = [];
    mockStudents = [student({ id: 's1', name: 'Asha', grade: '5', section: 'B' })];

    const res = await request(app)
      .get('/api/attendance/teacher/students')
      .query({ className: 'Class 5', section: 'B', date: '2026-08-18' });

    expect(res.status).toBe(403);
  });

  test('students outside the teacher scope are filtered out', async () => {
    mockScope = [{ className: '5', sectionName: 'B', normalizedClass: '5', normalizedSection: 'b', subjects: [], isClassTeacher: true }];
    mockStudents = [
      student({ id: 's1', name: 'Asha', grade: '5', section: 'B' }),
      student({ id: 's2', name: 'Zoe', grade: '5', section: 'A' }),
    ];

    const res = await request(app)
      .get('/api/attendance/teacher/students')
      .query({ className: '5', section: 'B', date: '2026-08-18' });

    expect(res.status).toBe(200);
    expect(res.body.students.map((s) => s.name)).toEqual(['Asha']);
  });
});
