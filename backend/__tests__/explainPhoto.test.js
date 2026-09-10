/**
 * Student "photo of a problem" → vision explanation. URL is restricted to the
 * app's Cloudinary host (SSRF guard), image is fetched + base64'd, and the call
 * is logged as an AI interaction.
 */
const express = require('express');
const request = require('supertest');

describe('POST /api/ai-tutor/explain-photo', () => {
  let app, mockAxios;

  beforeEach(() => {
    jest.resetModules();
    mockAxios = {
      get: jest.fn(),
      post: jest.fn(),
    };
    jest.doMock('axios', () => mockAxios);
    jest.doMock('../middleware/authStudent', () => (req, _res, next) => { req.schoolId = 'sch1'; req.user = { id: 'stud1' }; next(); });
    jest.doMock('../middleware/authTeacher', () => (req, _res, next) => next());
    jest.doMock('../middleware/adminAuth', () => (req, _res, next) => next());
    jest.doMock('../models/StudentUser', () => ({ findOne: () => ({ select: () => ({ lean: () => Promise.resolve({ grade: '7' }) }) }) }));
    jest.doMock('../models/TeachingMaterial', () => ({}));
    jest.doMock('../models/LessonPlan', () => ({}));
    jest.doMock('../models/StudentProgress', () => ({}));
    jest.doMock('../utils/studentContextBuilder', () => ({ buildStudentContext: jest.fn() }));
    jest.doMock('../utils/teachingMaterialAccess', () => ({ partitionMaterialsByEnabled: jest.fn(() => ({ enabled: [], disabledIds: [] })) }));
    jest.doMock('../services/aiInteractionLogger', () => ({ logAiInteraction: jest.fn() }));

    app = express();
    app.use(express.json());
    app.use('/api/ai-tutor', require('../routes/aiTutorRoutes'));
  });

  const CLOUD = 'https://res.cloudinary.com/demo/image/upload/problem.jpg';

  test('rejects a non-Cloudinary URL (SSRF guard)', async () => {
    const r = await request(app).post('/api/ai-tutor/explain-photo')
      .send({ imageUrl: 'https://evil.example.com/x.png', question: 'what is this?' });
    expect(r.status).toBe(400);
    expect(mockAxios.get).not.toHaveBeenCalled();
  });

  test('rejects a missing question', async () => {
    const r = await request(app).post('/api/ai-tutor/explain-photo').send({ imageUrl: CLOUD });
    expect(r.status).toBe(400);
  });

  test('rejects a URL that does not return an image', async () => {
    mockAxios.get.mockResolvedValue({ headers: { 'content-type': 'text/html' }, data: Buffer.from('nope') });
    const r = await request(app).post('/api/ai-tutor/explain-photo').send({ imageUrl: CLOUD, question: 'q' });
    expect(r.status).toBe(400);
  });

  test('fetches the image, calls the vision service, returns the explanation', async () => {
    mockAxios.get.mockResolvedValue({ headers: { 'content-type': 'image/jpeg' }, data: Buffer.from('JPEGDATA') });
    mockAxios.post.mockResolvedValue({ data: { explanation: 'This is a right triangle.', model_used: 'qwen2.5vl:7b' } });

    const r = await request(app).post('/api/ai-tutor/explain-photo')
      .send({ imageUrl: CLOUD, question: 'What shape is this?', subject: 'Math' });

    expect(r.status).toBe(200);
    expect(r.body.data.explanation).toBe('This is a right triangle.');
    const [url, payload] = mockAxios.post.mock.calls[0];
    expect(url).toMatch(/\/vision\/explain-image$/);
    expect(payload.image).toBe(Buffer.from('JPEGDATA').toString('base64'));
    expect(payload.grade_level).toBe('Grade 7');
    expect(require('../services/aiInteractionLogger').logAiInteraction).toHaveBeenCalledWith(
      expect.objectContaining({ feature: 'vision_explain_photo', status: 'success' })
    );
  });
});
