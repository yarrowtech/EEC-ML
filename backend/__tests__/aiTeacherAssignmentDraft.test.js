const express = require('express');
const request = require('supertest');

describe('AI teacher assignment draft endpoint', () => {
  let app;
  let mockAxios;
  let mockClass;
  let mockSection;
  let mockSubject;

  const queryResult = (value) => ({
    select: jest.fn(() => ({
      lean: jest.fn(() => Promise.resolve(value)),
    })),
  });

  beforeEach(() => {
    jest.resetModules();

    mockAxios = { post: jest.fn() };
    mockClass = { findOne: jest.fn(() => queryResult({ _id: 'class-1', name: '5' })) };
    mockSection = { findOne: jest.fn(() => queryResult({ _id: 'section-1', name: 'A' })) };
    mockSubject = { findOne: jest.fn(() => queryResult({ _id: 'subject-1', name: 'Mathematics' })) };

    jest.doMock('axios', () => mockAxios);
    jest.doMock('../middleware/authTeacher', () => (req, _res, next) => {
      req.schoolId = 'school-1';
      req.teacher = { id: 'teacher-1', schoolId: 'school-1' };
      next();
    });
    jest.doMock('../models/Class', () => mockClass);
    jest.doMock('../models/Section', () => mockSection);
    jest.doMock('../models/Subject', () => mockSubject);
    jest.doMock('../models/StudentUser', () => ({}));
    jest.doMock('../models/ExamResult', () => ({}));
    jest.doMock('../models/MasteryScore', () => ({}));

    app = express();
    app.use(express.json());
    app.use('/api/ai-teacher', require('../routes/aiTeacherRoutes'));
  });

  test('returns a structured draft grounded in the selected class material', async () => {
    mockAxios.post.mockResolvedValue({
      data: {
        groundedInMaterial: true,
        noMaterialFound: false,
        citations: [{ source: 'Fractions chapter.pdf' }],
        content: '```json\n{"title":"Equivalent Fractions Challenge","description":"1. Compare two fractions.\\n2. Explain the result.","marks":25,"difficulty":"Medium","activityType":"Assignment","submissionFormat":"text","isEssay":false,"rubric":""}\n```',
      },
    });

    const response = await request(app)
      .post('/api/ai-teacher/assignment-draft')
      .send({
        classId: 'class-1',
        sectionId: 'section-1',
        subjectId: 'subject-1',
        subject: 'Mathematics',
        topic: 'Fractions',
        chapterTitle: 'Fractions',
        difficulty: 'Medium',
        activityType: 'Assignment',
        marks: 25,
      });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({
      groundedInMaterial: true,
      draft: expect.objectContaining({
        title: 'Equivalent Fractions Challenge',
        marks: 25,
        type: 'Assignment',
      }),
    }));
    expect(mockAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/generate/tutor'),
      expect.objectContaining({
        schoolId: 'school-1',
        classId: 'class-1',
        sectionId: 'section-1',
        subjectId: 'subject-1',
        chapterTitle: 'Fractions',
      }),
      { timeout: 120000 }
    );
  });

  test('does not generate generic work when scoped material is unavailable', async () => {
    mockAxios.post.mockResolvedValue({
      data: { groundedInMaterial: false, noMaterialFound: true, content: '' },
    });

    const response = await request(app)
      .post('/api/ai-teacher/assignment-draft')
      .send({
        classId: 'class-1',
        sectionId: 'section-1',
        subjectId: 'subject-1',
        subject: 'Mathematics',
        topic: 'Fractions',
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toMatch(/No indexed material matched/i);
  });

  test('normalizes a plain Ollama MCQ into four options and a correct answer', async () => {
    mockAxios.post.mockResolvedValue({
      data: {
        groundedInMaterial: true,
        noMaterialFound: false,
        content: [
          '1. Which fraction is equivalent to one half?',
          'A) 1/3',
          'B) 2/4',
          'C) 3/4',
          'D) 4/5',
          'Answer: B',
          'Explanation: Multiplying one half by two over two gives two fourths.',
        ].join('\n'),
      },
    });

    const response = await request(app)
      .post('/api/ai-teacher/quiz-generate')
      .send({
        classId: 'class-1',
        sectionId: 'section-1',
        subjectId: 'subject-1',
        academicYearId: 'year-1',
        subject: 'Mathematics',
        topic: 'Fractions',
        questionType: 'mcq',
        count: 1,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.questions).toEqual([
      expect.objectContaining({
        questionText: 'Which fraction is equivalent to one half?',
        correctAnswer: '2/4',
        options: [
          { text: '1/3', isCorrect: false },
          { text: '2/4', isCorrect: true },
          { text: '3/4', isCorrect: false },
          { text: '4/5', isCorrect: false },
        ],
      }),
    ]);
    expect(mockAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/generate/tutor'),
      expect.objectContaining({
        questionType: 'mcq',
        classId: 'class-1',
        sectionId: 'section-1',
        subjectId: 'subject-1',
        academicYearId: 'year-1',
      }),
      { timeout: 120000 }
    );
  });
});
