/**
 * AI personalisation consent gate — feeding a student's personal learning data
 * into an LLM prompt requires recorded parental consent (per-org overridable).
 */
const mockStudentUser = { findOne: jest.fn(), findOneAndUpdate: jest.fn() };
const mockOrg = { findOne: jest.fn() };
jest.mock('../models/StudentUser', () => mockStudentUser);
jest.mock('../models/Organization', () => mockOrg);
jest.mock('../models/AuditLog', () => ({ create: jest.fn(() => Promise.resolve({})) }));

const { personalisationAllowed, recordConsent, orgRequiresConsent } = require('../services/aiConsentService');

const sel = (v) => ({ select: () => ({ lean: () => Promise.resolve(v) }) });

beforeEach(() => {
  jest.clearAllMocks();
  mockOrg.findOne.mockReturnValue(sel(null)); // default policy
});

describe('personalisationAllowed', () => {
  test('blocked when consent is required and not on file', async () => {
    mockStudentUser.findOne.mockReturnValue(sel({ parentConsentGivenAt: null }));
    const r = await personalisationAllowed({ studentId: 's1', schoolId: 'sch1' });
    expect(r).toMatchObject({ allowed: false, requiresConsent: true, reason: 'consent_missing' });
  });

  test('allowed when consent is on file', async () => {
    mockStudentUser.findOne.mockReturnValue(sel({ parentConsentGivenAt: new Date('2026-01-01') }));
    const r = await personalisationAllowed({ studentId: 's1', schoolId: 'sch1' });
    expect(r).toMatchObject({ allowed: true, reason: 'consent_on_file' });
  });

  test('allowed when the org has opted out of the consent requirement', async () => {
    mockOrg.findOne.mockReturnValue(sel({ settings: { ai: { personalisationRequiresConsent: false } } }));
    mockStudentUser.findOne.mockReturnValue(sel({ parentConsentGivenAt: null }));
    const r = await personalisationAllowed({ studentId: 's1', schoolId: 'sch1' });
    expect(r).toMatchObject({ allowed: true, requiresConsent: false });
  });

  test('fails safe (consent required) if the org lookup throws', async () => {
    mockOrg.findOne.mockImplementation(() => { throw new Error('db'); });
    expect(await orgRequiresConsent('sch1')).toBe(true);
  });
});

describe('recordConsent', () => {
  test('stamps the consent fields and writes an audit entry', async () => {
    mockStudentUser.findOneAndUpdate.mockReturnValue(sel({ name: 'Ada', parentConsentGivenAt: new Date(), parentConsentGivenBy: 'Parent A' }));
    const r = await recordConsent({ studentId: 's1', schoolId: 'sch1', givenBy: 'Parent A', actor: { id: 'a1', type: 'admin' } });
    expect(r.student.parentConsentGivenBy).toBe('Parent A');
    const set = mockStudentUser.findOneAndUpdate.mock.calls[0][1].$set;
    expect(set.parentConsentGivenAt).toBeInstanceOf(Date);
    expect(require('../models/AuditLog').create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ai_personalisation.consent_recorded' })
    );
  });

  test('returns notFound for an unknown student', async () => {
    mockStudentUser.findOneAndUpdate.mockReturnValue(sel(null));
    const r = await recordConsent({ studentId: 'x', schoolId: 'sch1', givenBy: 'P' });
    expect(r.notFound).toBe(true);
  });
});
