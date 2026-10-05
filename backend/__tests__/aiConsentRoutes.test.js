const express = require('express');
const request = require('supertest');
const mockParent = { findOne: jest.fn() };
const mockStudent = { exists: jest.fn() };
const mockConsent = { personalisationAllowed: jest.fn(), recordConsent: jest.fn(), withdrawConsent: jest.fn() };
jest.mock('../models/ParentUser', () => mockParent);
jest.mock('../models/StudentUser', () => mockStudent);
jest.mock('../services/aiConsentService', () => mockConsent);
jest.mock('../middleware/authParent', () => (req, res, next) => { req.user = { id: 'parent' }; req.schoolId = 'school'; next(); });
jest.mock('../middleware/adminAuth', () => (req, res, next) => next());
const app = express();
app.use(express.json());
app.use('/consent', require('../routes/aiConsentRoutes'));
const child = '507f1f77bcf86cd799439011';
beforeEach(() => {
  jest.clearAllMocks();
  mockParent.findOne.mockReturnValue({ select: () => ({ lean: async () => ({ name: 'Guardian' }) }) });
  mockStudent.exists.mockResolvedValue({ _id: child });
  mockConsent.personalisationAllowed.mockResolvedValue({ allowed: false, reason: 'consent_withdrawn' });
  mockConsent.withdrawConsent.mockResolvedValue({ student: {} });
});
test('withdrawal uses authenticated parent identity and school, ignoring supplied actor', async () => {
  const result = await request(app).put(`/consent/parent/${child}`).send({ granted: false, schoolId: 'other', givenBy: 'Imposter' });
  expect(result.status).toBe(200);
  expect(mockParent.findOne).toHaveBeenCalledWith({ _id: 'parent', schoolId: 'school', childrenIds: child });
  expect(mockConsent.withdrawConsent).toHaveBeenCalledWith(expect.objectContaining({ studentId: child, schoolId: 'school', givenBy: 'Guardian', actor: { id: 'parent', type: 'parent', name: 'Guardian' } }));
});
test('unlinked child cannot be read or changed', async () => {
  mockParent.findOne.mockReturnValue({ select: () => ({ lean: async () => null }) });
  expect((await request(app).get(`/consent/parent/${child}`)).status).toBe(403);
  expect((await request(app).put(`/consent/parent/${child}`).send({ granted: true })).status).toBe(403);
  expect(mockConsent.recordConsent).not.toHaveBeenCalled();
  expect(mockConsent.personalisationAllowed).not.toHaveBeenCalled();
});
test('rejects non-boolean decisions and invalid child IDs', async () => {
  expect((await request(app).put(`/consent/parent/${child}`).send({ granted: 'false' })).status).toBe(400);
  expect((await request(app).get('/consent/parent/bad-id')).status).toBe(400);
  expect(mockConsent.withdrawConsent).not.toHaveBeenCalled();
});
