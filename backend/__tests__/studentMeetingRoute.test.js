const express = require('express');
const request = require('supertest');

const mockParentMeeting = { find: jest.fn() };

jest.mock('../models/ParentMeeting', () => mockParentMeeting);
jest.mock('../models/StudentUser', () => ({}));
jest.mock('../models/ParentUser', () => ({}));
jest.mock('../models/AcademicYear', () => ({}));
jest.mock('../models/Notification', () => ({}));
jest.mock('../middleware/authTeacher', () => (req, res, next) => next());
jest.mock('../middleware/authParent', () => (req, res, next) => next());
jest.mock('../middleware/authStudent', () => (req, res, next) => {
  req.user = { id: 'student-1', schoolId: 'school-1' };
  req.schoolId = 'school-1';
  req.campusId = 'campus-1';
  next();
});

const makeQuery = (value) => {
  const query = {
    populate: jest.fn(() => query),
    sort: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue(value),
  };
  return query;
};

const meetingRoute = require('../routes/meetingRoute');
const app = express();
app.use(express.json());
app.use('/meeting', meetingRoute);

describe('student meeting visibility', () => {
  test('returns only meetings scheduled for the signed-in student and campus', async () => {
    mockParentMeeting.find.mockReturnValue(makeQuery([{
      _id: 'meeting-1',
      studentId: 'student-1',
      title: 'Term progress review',
      teacherId: { name: 'Teacher One' },
    }]));

    const response = await request(app).get('/meeting/student/my-meetings');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({ _id: 'meeting-1', title: 'Term progress review' }),
    ]);
    expect(mockParentMeeting.find).toHaveBeenCalledWith({
      schoolId: 'school-1',
      studentId: 'student-1',
      $or: [
        { campusId: 'campus-1' },
        { campusId: { $exists: false } },
        { campusId: null },
      ],
    });
  });
});
