const mockStudent = { findOne: jest.fn(), findOneAndUpdate: jest.fn() };
const mockOrg = { findOne: jest.fn() };
const mockSchool = { findOne: jest.fn() };
const mockAudit = { create: jest.fn() };
const mockSession = { withTransaction: jest.fn(async (fn) => fn()), endSession: jest.fn() };
jest.mock('../models/StudentUser', () => mockStudent);
jest.mock('../models/Organization', () => mockOrg);
jest.mock('../models/School', () => mockSchool);
jest.mock('../models/AuditLog', () => mockAudit);
jest.mock('mongoose', () => ({ startSession: jest.fn(async () => mockSession) }));
const { personalisationAllowed, recordConsent, withdrawConsent, orgRequiresConsent } = require('../services/aiConsentService');
const sel = (value) => ({ select: () => ({ lean: async () => value }) });
const scope = { studentId: 'student', schoolId: 'school' };
const actor = { id: 'parent', type: 'parent' };
beforeEach(() => {
  jest.clearAllMocks();
  mockAudit.create.mockResolvedValue([]);
  mockSchool.findOne.mockReturnValue(sel({ organizationId: 'org' }));
  mockOrg.findOne.mockReturnValue(sel(null));
  mockStudent.findOne.mockReturnValue(sel({}));
});
test('missing consent blocks personalisation', async () => {
  expect(await personalisationAllowed(scope)).toMatchObject({ allowed: false, reason: 'consent_missing' });
  expect(mockStudent.findOne).toHaveBeenCalledWith({ _id: 'student', schoolId: 'school' });
});
test('recorded consent permits personalisation', async () => {
  mockStudent.findOne.mockReturnValue(sel({ parentConsentGivenAt: new Date() }));
  expect(await personalisationAllowed(scope)).toMatchObject({ allowed: true, reason: 'consent_on_file' });
});
test('resolves policy using the school organization, never a school ID as organization ID', async () => {
  mockOrg.findOne.mockReturnValue(sel({ settings: { ai: { personalisationRequiresConsent: false } } }));
  expect(await personalisationAllowed(scope)).toMatchObject({ allowed: true, requiresConsent: false });
  expect(mockOrg.findOne).toHaveBeenCalledWith({ _id: 'org' });
});
test('withdrawal overrides permissive organisation policy', async () => {
  mockOrg.findOne.mockReturnValue(sel({ settings: { ai: { personalisationRequiresConsent: false } } }));
  mockStudent.findOne.mockReturnValue(sel({ parentConsentWithdrawnAt: new Date() }));
  expect(await personalisationAllowed(scope)).toMatchObject({ allowed: false, reason: 'consent_withdrawn' });
});
test('unknown students cannot use permissive organisation policy', async () => {
  mockOrg.findOne.mockReturnValue(sel({ settings: { ai: { personalisationRequiresConsent: false } } }));
  mockStudent.findOne.mockReturnValue(sel(null));
  expect(await personalisationAllowed(scope)).toMatchObject({ allowed: false, reason: 'student_not_found' });
});
test('policy lookup failure requires consent', async () => {
  mockSchool.findOne.mockImplementation(() => { throw new Error('database'); });
  expect(await orgRequiresConsent('school')).toBe(true);
});
test('grant clears withdrawal and shares transaction with audit', async () => {
  mockStudent.findOneAndUpdate.mockReturnValue(sel({ parentConsentGivenAt: new Date() }));
  await recordConsent({ ...scope, givenBy: 'Guardian', actor });
  expect(mockStudent.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ schoolId: 'school' }),
    { $set: expect.objectContaining({ parentConsentWithdrawnAt: null, parentConsentGivenBy: 'Guardian' }) },
    expect.objectContaining({ session: mockSession }));
  expect(mockAudit.create).toHaveBeenCalledWith([expect.objectContaining({ action: 'ai_personalisation.consent_recorded', actorId: 'parent' })], { session: mockSession });
});
test('withdrawal clears consent and records actor', async () => {
  mockStudent.findOneAndUpdate.mockReturnValue(sel({ parentConsentWithdrawnAt: new Date() }));
  await withdrawConsent({ ...scope, actor });
  expect(mockStudent.findOneAndUpdate.mock.calls[0][1].$set).toMatchObject({ parentConsentGivenAt: null, parentConsentGivenBy: '', parentConsentWithdrawnAt: expect.any(Date) });
});
test('audit failure propagates through transaction and session is closed', async () => {
  mockStudent.findOneAndUpdate.mockReturnValue(sel({}));
  mockAudit.create.mockRejectedValue(new Error('audit failed'));
  await expect(recordConsent({ ...scope, givenBy: 'Guardian', actor })).rejects.toThrow('audit failed');
  expect(mockSession.endSession).toHaveBeenCalled();
});
test('missing student returns notFound without an audit entry', async () => {
  mockStudent.findOneAndUpdate.mockReturnValue(sel(null));
  expect(await withdrawConsent({ ...scope, actor })).toEqual({ notFound: true });
  expect(mockAudit.create).not.toHaveBeenCalled();
});
