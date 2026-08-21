const express = require('express');
const request = require('supertest');

describe('assignment workflow boundaries', () => {
  let app;
  let Assignment;
  let StudentProgress;
  let StudentUser;
  let Class;
  let Section;
  let LessonPlan;

  const activeYear = { _id: 'year-1', name: '2026-27' };
  const student = { _id: 'student-1', grade: '5', section: 'A', campusId: null };
  const classDoc = { _id: 'class-1', name: '5' };
  const sectionDoc = { _id: 'section-1', name: 'A', classId: 'class-1' };

  beforeEach(() => {
    jest.resetModules();

    jest.doMock('../middleware/adminAuth', () => (req, _res, next) => next());
    jest.doMock('../middleware/authStudent', () => (req, _res, next) => {
      req.schoolId = 'school-1';
      req.user = { id: 'student-1', schoolId: 'school-1' };
      next();
    });
    jest.doMock('../middleware/authTeacher', () => (req, _res, next) => {
      req.schoolId = 'school-1';
      req.user = { id: 'teacher-1', schoolId: 'school-1' };
      req.teacher = req.user;
      next();
    });
    jest.doMock('../utils/logger', () => ({
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    }));
    jest.doMock('../utils/studentPortalLogger', () => ({
      logStudentPortalEvent: jest.fn(),
      logStudentPortalError: jest.fn(),
    }));
    jest.doMock('../utils/notificationService', () => ({
      notifyAssignmentCreated: jest.fn(),
      notifyMarksPublished: jest.fn(),
    }));

    Assignment = Object.assign(jest.fn(function AssignmentDocument(data) {
      Object.assign(this, data);
      this.save = jest.fn(() => Promise.resolve(this));
    }), {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndDelete: jest.fn(),
    });
    StudentProgress = { findOne: jest.fn(), find: jest.fn() };
    StudentUser = { findOne: jest.fn(), find: jest.fn() };
    Class = { findOne: jest.fn(), find: jest.fn() };
    Section = { findOne: jest.fn(), find: jest.fn() };
    LessonPlan = { findOne: jest.fn() };

    jest.doMock('../models/Assignment', () => Assignment);
    jest.doMock('../models/StudentProgress', () => StudentProgress);
    jest.doMock('../models/StudentUser', () => StudentUser);
    jest.doMock('../models/Class', () => Class);
    jest.doMock('../models/Section', () => Section);
    jest.doMock('../models/LessonPlan', () => LessonPlan);
    jest.doMock('../models/Timetable', () => ({ find: jest.fn() }));
    jest.doMock('../models/AcademicYear', () => ({
      findOne: jest.fn(() => ({
        select: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(activeYear)) })),
      })),
    }));

    StudentUser.findOne.mockReturnValue({
      select: jest.fn(() => Promise.resolve(student)),
    });
    Class.findOne.mockResolvedValue(classDoc);
    Section.findOne.mockResolvedValue(sectionDoc);

    app = express();
    app.use(express.json());
    app.use('/api/assignment', require('../routes/assignmentRoute'));
  });

  test('masks a graded result until the teacher publishes it', async () => {
    const assignment = {
      _id: 'assignment-1',
      schoolId: 'school-1',
      classId: 'class-1',
      sectionId: 'section-1',
      status: 'active',
      academicYearId: 'year-1',
      marks: 20,
      dueDate: new Date(Date.now() + 86400000),
      submissionFormat: 'text',
      toObject: () => ({
        _id: 'assignment-1',
        classId: 'class-1',
        sectionId: 'section-1',
        status: 'active',
        marks: 20,
      }),
    };
    Assignment.find.mockReturnValue({
      populate: jest.fn(() => ({ sort: jest.fn(() => Promise.resolve([assignment])) })),
    });
    StudentProgress.findOne.mockResolvedValue({
      submissions: [{
        assignmentId: 'assignment-1',
        status: 'graded',
        submittedAt: new Date(),
        score: 17,
        feedback: 'Good work',
        publishedByTeacher: false,
      }],
    });

    const response = await request(app).get('/api/assignment/student/assignments');

    expect(response.status).toBe(200);
    expect(response.body[0]).toEqual(expect.objectContaining({
      submissionStatus: 'submitted',
      publishedByTeacher: false,
    }));
    expect(response.body[0]).not.toHaveProperty('score');
    expect(response.body[0]).not.toHaveProperty('feedback');
  });

  test('creates an assignment linked to a published lesson plan chapter', async () => {
    LessonPlan.findOne.mockReturnValue({
      lean: jest.fn(() => Promise.resolve({
        _id: '507f1f77bcf86cd799439011',
        teacherId: 'teacher-1',
        schoolId: 'school-1',
        classId: 'class-1',
        sectionId: 'section-1',
        subject: 'Mathematics',
        status: 'published',
        isDraft: false,
        plannerContent: {
          chapters: [{ id: 'fractions', title: 'Fractions' }],
        },
      })),
    });

    const response = await request(app)
      .post('/api/assignment/teacher/create')
      .send({
        title: 'Equivalent fractions',
        subject: 'Mathematics',
        classId: 'class-1',
        sectionId: 'section-1',
        marks: 20,
        dueDate: '2026-09-01',
        sourceLessonPlanId: '507f1f77bcf86cd799439011',
        chapterId: 'fractions',
        chapterTitle: 'Fractions',
      });

    expect(response.status).toBe(201);
    expect(response.body.assignment).toEqual(expect.objectContaining({
      sourceLessonPlanId: '507f1f77bcf86cd799439011',
      chapterId: 'fractions',
      chapterTitle: 'Fractions',
    }));
    expect(LessonPlan.findOne).toHaveBeenCalledWith(expect.objectContaining({
      schoolId: 'school-1',
      teacherId: 'teacher-1',
    }));
  });

  test('rejects a lesson plan from another class', async () => {
    LessonPlan.findOne.mockReturnValue({
      lean: jest.fn(() => Promise.resolve({
        _id: '507f1f77bcf86cd799439012',
        classId: 'class-2',
        sectionId: 'section-1',
        subject: 'Mathematics',
        status: 'published',
        isDraft: false,
        plannerContent: { chapters: [{ id: 'fractions', title: 'Fractions' }] },
      })),
    });

    const response = await request(app)
      .post('/api/assignment/teacher/create')
      .send({
        title: 'Wrong class link',
        subject: 'Mathematics',
        classId: 'class-1',
        sectionId: 'section-1',
        dueDate: '2026-09-01',
        sourceLessonPlanId: '507f1f77bcf86cd799439012',
        chapterId: 'fractions',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/selected class/i);
    expect(Assignment).not.toHaveBeenCalled();
  });

  test('publishes a completed assignment draft to the student portal', async () => {
    const draft = {
      _id: 'assignment-draft-1',
      schoolId: 'school-1',
      teacherId: 'teacher-1',
      academicYearId: 'year-1',
      title: 'Equivalent fractions',
      subject: 'Mathematics',
      classId: 'class-1',
      sectionId: 'section-1',
      dueDate: new Date('2026-09-01T00:00:00.000Z'),
      marks: 20,
      status: 'draft',
      publishedForStudentPortal: false,
      save: jest.fn(() => Promise.resolve()),
    };
    Assignment.findOne.mockResolvedValue(draft);
    const NotificationService = require('../utils/notificationService');

    const response = await request(app)
      .patch('/api/assignment/teacher/publish/assignment-draft-1')
      .send({});

    expect(response.status).toBe(200);
    expect(draft.status).toBe('active');
    expect(draft.publishedForStudentPortal).toBe(true);
    expect(draft.save).toHaveBeenCalledTimes(1);
    expect(Assignment.findOne).toHaveBeenCalledWith({
      _id: 'assignment-draft-1',
      schoolId: 'school-1',
      teacherId: 'teacher-1',
    });
    expect(NotificationService.notifyAssignmentCreated).toHaveBeenCalledWith(expect.objectContaining({
      schoolId: 'school-1',
      assignment: draft,
      createdBy: 'teacher-1',
    }));
  });

  test('rejects submission to another class assignment', async () => {
    Assignment.findOne.mockReturnValue({
      lean: jest.fn(() => Promise.resolve({
        _id: 'assignment-2',
        schoolId: 'school-1',
        classId: 'class-2',
        sectionId: 'section-2',
        academicYearId: 'year-1',
        status: 'active',
        submissionFormat: 'text',
      })),
    });

    const response = await request(app)
      .post('/api/assignment/submit')
      .send({ assignmentId: 'assignment-2', submissionText: 'My answer' });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/not assigned to your class/i);
    expect(StudentProgress.findOne).not.toHaveBeenCalled();
  });

  test('rejects a teacher score above the assignment total', async () => {
    Assignment.findOne.mockResolvedValue({
      _id: 'assignment-1',
      schoolId: 'school-1',
      teacherId: 'teacher-1',
      academicYearId: 'year-1',
      marks: 20,
    });

    const response = await request(app)
      .post('/api/assignment/teacher/grade')
      .send({
        studentId: 'student-1',
        assignmentId: 'assignment-1',
        score: 21,
        feedback: 'Invalid score',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/between 0 and 20/i);
    expect(StudentProgress.findOne).not.toHaveBeenCalled();
  });

  test('unpublishes a result when the teacher changes its grade', async () => {
    Assignment.findOne.mockResolvedValue({
      _id: 'assignment-1',
      schoolId: 'school-1',
      teacherId: 'teacher-1',
      academicYearId: 'year-1',
      marks: 20,
    });
    const progress = {
      submissions: [{
        assignmentId: 'assignment-1',
        status: 'graded',
        score: 17,
        feedback: 'Old feedback',
        publishedByTeacher: true,
        publishedAt: new Date(),
      }],
      save: jest.fn(() => Promise.resolve()),
    };
    StudentProgress.findOne.mockResolvedValue(progress);

    const response = await request(app)
      .post('/api/assignment/teacher/grade')
      .send({
        studentId: 'student-1',
        assignmentId: 'assignment-1',
        score: 18,
        feedback: 'Revised feedback',
      });

    expect(response.status).toBe(200);
    expect(progress.submissions[0]).toEqual(expect.objectContaining({
      score: 18,
      feedback: 'Revised feedback',
      publishedByTeacher: false,
      publishedAt: null,
    }));
    expect(progress.save).toHaveBeenCalledTimes(1);
  });

  test('publishes a reviewed result for the selected student', async () => {
    Assignment.findOne.mockResolvedValue({
      _id: 'assignment-1',
      schoolId: 'school-1',
      teacherId: 'teacher-1',
      marks: 20,
    });
    const progress = {
      submissions: [{
        assignmentId: 'assignment-1',
        status: 'graded',
        score: 18,
        publishedByTeacher: false,
        publishedAt: null,
      }],
      save: jest.fn(() => Promise.resolve()),
    };
    StudentProgress.find.mockResolvedValue([progress]);

    const response = await request(app)
      .post('/api/assignment/teacher/publish-grades')
      .send({ assignmentId: 'assignment-1', studentIds: ['student-1'] });

    expect(response.status).toBe(200);
    expect(response.body.publishedCount).toBe(1);
    expect(progress.submissions[0].publishedByTeacher).toBe(true);
    expect(progress.submissions[0].publishedAt).toBeInstanceOf(Date);
    expect(progress.save).toHaveBeenCalledTimes(1);
  });
});
