const express = require('express');
const request = require('supertest');
const mockConsent = jest.fn();
const mockCacheRead = jest.fn();
const mockAi = jest.fn();
jest.mock('axios', () => ({ post: (...args) => mockAi(...args) }));
jest.mock('../middleware/authParent', () => (req, res, next) => { req.user = { id: 'parent' }; req.schoolId = 'school'; next(); });
jest.mock('../services/aiConsentService', () => ({ personalisationAllowed: (...args) => mockConsent(...args) }));
jest.mock('../utils/parentChildren', () => ({ resolveParentChildren: async () => ({ childIds: ['child'] }), parentOwnsStudent: (ids, id) => ids.includes(id) }));
jest.mock('../models/ParentDashboardReport', () => ({ findOne: (...args) => mockCacheRead(...args) }));
const app = express();
app.use(require('../routes/parentDashboardRoutes'));
beforeEach(() => jest.clearAllMocks());
test.each(['home-support', 'weekly-digest', 'monthly-report'])('%s checks withdrawal before cache or generation', async (path) => {
  mockConsent.mockResolvedValue({ allowed: false });
  const result = await request(app).get(`/${path}/child`);
  expect(result.status).toBe(403);
  expect(result.body.code).toBe('AI_CONSENT_REQUIRED');
  expect(mockCacheRead).not.toHaveBeenCalled();
  expect(mockAi).not.toHaveBeenCalled();
});
test('consented report cache includes school and parent scope', async () => {
  mockConsent.mockResolvedValue({ allowed: true });
  mockCacheRead.mockReturnValue({ lean: async () => ({ content: 'Report', generatedAt: new Date() }) });
  expect((await request(app).get('/home-support/child')).status).toBe(200);
  expect(mockCacheRead).toHaveBeenCalledWith({ parentId: 'parent', studentId: 'child', schoolId: 'school', type: 'home_support' });
});
