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
const mockSubject = { find: jest.fn() };

jest.mock('../models/StudentUser', () => mockStudentUser);
jest.mock('../models/LessonPlan', () => mockLessonPlan);
jest.mock('../models/TeachingMaterial', () => mockTeachingMaterial);
jest.mock('../models/PracticePaper', () => mockPracticePaper);
jest.mock('../models/Assignment', () => mockAssignment);
jest.mock('../models/Subject', () => mockSubject);

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
    mockSubject.find.mockReturnValue({ select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })) });
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

  test('keeps each chapter\'s assigned tryouts separate even when teachers leave topic ids at their generic default', async () => {
    // Real teacher data regularly leaves chapter/topic ids at the generator's
    // default ("chapter-1"/"topic-1") since each lesson plan only ever
    // contains one chapter. Two unrelated chapters sharing that same default
    // id must not have their tryoutSections merged into a single topic entry.
    const SUBJECT_ID = '6989b681671f37254a4a8542';
    const makePlan = ({ id, title, tryoutSections }) => ({
      _id: id,
      schoolId: SCHOOL_ID,
      campusId: CAMPUS_ID,
      classId: CLASS_ID,
      sectionId: SECTION_ID,
      className: '5',
      sectionName: 'A',
      status: 'published',
      isDraft: false,
      subjectId: SUBJECT_ID,
      subject: 'English',
      subjectName: 'English',
      date: new Date('2026-01-01'),
      createdAt: new Date('2026-01-01'),
      plannerContent: {
        chapters: [{
          id: 'chapter-1',
          title,
          topics: [{
            id: 'topic-1',
            title,
            subTopics: [{
              id: 'subtopic-1',
              title: 'Overview',
              tryoutSections,
            }],
          }],
        }],
      },
    });

    // The chapter with no real tryout is processed first, matching the
    // production ordering that used to make the bug hide the real one.
    mockLessonPlan.find.mockReturnValue(sortedQuery([
      makePlan({ id: 'plan-008', title: 'English Chapter 008', tryoutSections: [] }),
      makePlan({ id: 'plan-006', title: 'English Chapter 006', tryoutSections: [{ type: 'mcq', question: 'Q1' }] }),
    ]));

    const app = express();
    app.use('/lesson-plans', lessonPlanRoutes);

    const response = await request(app).get('/lesson-plans/student/smart-learning-map');

    expect(response.status).toBe(200);
    const topics = response.body.subjects[0].topics;
    const chapter006 = topics.find((t) => t.title === 'English Chapter 006');
    const chapter008 = topics.find((t) => t.title === 'English Chapter 008');

    expect(chapter006.tryoutSections).toHaveLength(1);
    expect(chapter008.tryoutSections || []).toHaveLength(0);
  });

  test('gives every chapter a distinct id even when the source plans all use the same default chapter/topic id', async () => {
    // The frontend uses chapter.id / topic.id as both the React key and the
    // <select> option value. If every chapter is exposed with the same
    // default id ("chapter-1"), only the first one is ever selectable —
    // picking any other chapter from the dropdown silently resolves back to
    // the first chapter's data instead.
    const SUBJECT_ID = '6989b681671f37254a4a8542';
    const makePlan = ({ id, title }) => ({
      _id: id,
      schoolId: SCHOOL_ID,
      campusId: CAMPUS_ID,
      classId: CLASS_ID,
      sectionId: SECTION_ID,
      className: '5',
      sectionName: 'A',
      status: 'published',
      isDraft: false,
      subjectId: SUBJECT_ID,
      subject: 'Mathematics',
      subjectName: 'Mathematics',
      date: new Date('2026-01-01'),
      createdAt: new Date('2026-01-01'),
      plannerContent: {
        chapters: [{
          id: 'chapter-1',
          title,
          topics: [{
            id: 'topic-1',
            title,
            subTopics: [{
              id: 'subtopic-1',
              title: 'Overview',
              tryoutSections: [{ type: 'mcq', question: `Q for ${title}` }],
            }],
          }],
        }],
      },
    });

    mockLessonPlan.find.mockReturnValue(sortedQuery([
      makePlan({ id: 'plan-numbers', title: 'Numbers' }),
      makePlan({ id: 'plan-revise', title: 'Let’s Revise What We Have Learned' }),
    ]));

    const app = express();
    app.use('/lesson-plans', lessonPlanRoutes);

    const response = await request(app).get('/lesson-plans/student/smart-learning-map');

    expect(response.status).toBe(200);
    const chapters = response.body.subjects[0].chapters;
    expect(chapters).toHaveLength(2);
    const ids = chapters.map((c) => c.id);
    expect(new Set(ids).size).toBe(2);

    const numbersChapter = chapters.find((c) => c.title === 'Numbers');
    expect(numbersChapter.topics[0].id).not.toBe(
      chapters.find((c) => c.title !== 'Numbers').topics[0].id
    );
  });
});
