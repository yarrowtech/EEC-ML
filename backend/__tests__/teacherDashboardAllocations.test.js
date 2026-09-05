const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

describe('GET /api/teacher/dashboard/allocations', () => {
  let app;

  const oid = (seed) => new mongoose.Types.ObjectId(seed.padEnd(24, '0'));
  const TEACHER_ID = oid('1e').toString();

  const classA = oid('a1');
  const sectionA = oid('a2');
  const subjectA = oid('a3');
  const classB = oid('b1');
  const sectionB = oid('b2');
  const subjectB = oid('b3');

  const leanChain = (value) => ({
    populate: jest.fn(function populate() { return this; }),
    sort: jest.fn(function sort() { return this; }),
    select: jest.fn(function select() { return this; }),
    lean: jest.fn(() => Promise.resolve(value)),
  });

  beforeEach(() => {
    jest.resetModules();

    jest.doMock('../middleware/authTeacher', () => (req, _res, next) => {
      req.schoolId = 'school-1';
      req.campusId = null;
      req.userType = 'teacher';
      req.user = { id: TEACHER_ID, userType: 'teacher' };
      next();
    });

    // The teacher has exactly ONE TeacherAllocation record: class-teacher of
    // Class A / Section A. Class B is something they ALSO teach, but only via
    // the timetable — no TeacherAllocation document exists for it.
    jest.doMock('../models/TeacherAllocation', () => ({
      find: jest.fn(() => leanChain([
        {
          _id: 'alloc-1',
          teacherId: TEACHER_ID,
          subjectId: null,
          isClassTeacher: true,
          classId: { _id: classA, name: '5' },
          sectionId: { _id: sectionA, name: 'A' },
        },
      ])),
    }));

    jest.doMock('../models/Timetable', () => ({
      find: jest.fn(() => leanChain([
        {
          _id: 'tt-a',
          classId: { _id: classA, name: '5' },
          sectionId: { _id: sectionA, name: 'A' },
          entries: [
            { teacherId: TEACHER_ID, subjectId: { _id: subjectA, name: 'Math' } },
          ],
        },
        {
          _id: 'tt-b',
          classId: { _id: classB, name: '6' },
          sectionId: { _id: sectionB, name: 'B' },
          entries: [
            { teacherId: TEACHER_ID, subjectId: { _id: subjectB, name: 'Science' } },
          ],
        },
      ])),
    }));

    jest.doMock('../models/TeacherUser', () => ({
      findById: jest.fn(() => leanChain({ subject: '' })),
    }));

    // Everything else this route file requires — unused by this endpoint,
    // stubbed so the module loads.
    ['StudentUser', 'ParentUser', 'ExamResult', 'StudentProgress', 'Assignment',
      'Subject', 'Class', 'Section', 'School', 'TeacherAttendance', 'TeacherLeave',
      'TeacherExpense', 'TeacherFeedback', 'SupportRequest', 'Notification',
      'ParentMeeting', 'TeacherTaskAcknowledgement'].forEach((model) => {
      jest.doMock(`../models/${model}`, () => ({}));
    });

    app = express();
    app.use(express.json());
    app.use('/api/teacher/dashboard', require('../routes/teacherDashboardRoutes'));
  });

  test('includes a class the teacher only teaches via the timetable, alongside their class-teacher allocation', async () => {
    const response = await request(app).get('/api/teacher/dashboard/allocations');

    expect(response.status).toBe(200);
    const classNames = response.body.map((item) => item.classId?.name);
    expect(classNames).toEqual(expect.arrayContaining(['5', '6']));

    const classBEntry = response.body.find((item) => item.classId?.name === '6');
    expect(classBEntry).toBeDefined();
    expect(classBEntry.sectionId?.name).toBe('B');
    expect(classBEntry.subjectId?.name).toBe('Science');
  });
});
