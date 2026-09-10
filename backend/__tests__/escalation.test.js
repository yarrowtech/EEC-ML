/**
 * Escalation workflow — routes distress / critical-risk signals to school
 * leadership + counselling, deduplicated per student/category/week.
 */
const mockCase = { findOne: jest.fn(), create: jest.fn() };
jest.mock('../models/EscalationCase', () => mockCase);
const mockNotify = jest.fn();
jest.mock('../utils/notificationService', () => ({ createNotification: (...a) => mockNotify(...a) }));
jest.mock('../models/AuditLog', () => ({ create: jest.fn(() => Promise.resolve({})) }));
jest.mock('../utils/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const mockPrincipal = { find: jest.fn() };
const mockStaff = { find: jest.fn() };
jest.mock('../models/Principal', () => mockPrincipal);
jest.mock('../models/StaffUser', () => mockStaff);

const lean = (v) => ({ select: () => ({ lean: () => Promise.resolve(v) }), lean: () => Promise.resolve(v) });
const openCase = (v) => ({ lean: () => Promise.resolve(v) });

const { assessWellbeing, isoWeekKey, raiseEscalation, findEscalationTargets, escalateWellbeingIfNeeded } = require('../services/escalationService');

beforeEach(() => {
  jest.clearAllMocks();
  mockPrincipal.find.mockReturnValue(lean([{ _id: 'p1', name: 'Principal Ada' }]));
  mockStaff.find.mockReturnValue(lean([
    { _id: 's1', name: 'Ms Counsel', position: 'School Counsellor', department: 'Student Welfare' },
    { _id: 's2', name: 'Mr Lab', position: 'Lab Assistant', department: 'Science' },
  ]));
});

describe('assessWellbeing', () => {
  test('mood=critical → critical escalation', () => {
    expect(assessWellbeing({ mood: 'critical' })).toMatchObject({ escalate: true, severity: 'critical' });
  });
  test('concerning + behaviour change → high escalation', () => {
    expect(assessWellbeing({ mood: 'concerning', behaviorChanges: true })).toMatchObject({ escalate: true, severity: 'high' });
  });
  test('concerning + high stress → high escalation', () => {
    expect(assessWellbeing({ mood: 'concerning', academicStress: 9 }).escalate).toBe(true);
  });
  test('concerning alone → no escalation', () => {
    expect(assessWellbeing({ mood: 'concerning', academicStress: 4, socialEngagement: 7 }).escalate).toBe(false);
  });
  test('good mood → no escalation', () => {
    expect(assessWellbeing({ mood: 'good' }).escalate).toBe(false);
  });
});

describe('isoWeekKey', () => {
  test('is stable within a week and formatted YYYY-Www', () => {
    const k = isoWeekKey(new Date('2026-03-10T12:00:00Z'));
    expect(k).toMatch(/^\d{4}-W\d{2}$/);
    expect(isoWeekKey(new Date('2026-03-11T00:00:00Z'))).toBe(k);
  });
});

describe('findEscalationTargets', () => {
  test('returns principals + welfare/counselling staff only', async () => {
    const targets = await findEscalationTargets({ schoolId: 'school1' });
    expect(targets).toEqual([
      { role: 'principal', userId: 'p1', name: 'Principal Ada' },
      { role: 'counsellor', userId: 's1', name: 'Ms Counsel' },
    ]);
  });
});

describe('raiseEscalation', () => {
  test('creates a case, assigns targets, and notifies them', async () => {
    mockCase.findOne.mockReturnValue(openCase(null)); // no open case
    mockCase.create.mockResolvedValue({ _id: 'case1' });

    const { created, case: c } = await raiseEscalation({
      schoolId: 'school1', studentId: 'stud1', studentName: 'Sam',
      category: 'wellbeing', severity: 'critical', summary: 'flagged',
      trigger: { signal: 'mood=critical' },
    });

    expect(created).toBe(true);
    const doc = mockCase.create.mock.calls[0][0];
    expect(doc.assignedTo).toHaveLength(2);
    expect(doc.dedupeKey).toMatch(/^school1:stud1:wellbeing:\d{4}-W\d{2}$/);
    expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({
      priority: 'high', category: 'welfare', targetUserIds: ['p1', 's1'],
    }));
  });

  test('does not raise a second case while one is still open this week', async () => {
    mockCase.findOne.mockReturnValue(openCase({ _id: "existing", status: "acknowledged" }));
    const { created } = await raiseEscalation({
      schoolId: 'school1', studentId: 'stud1', category: 'wellbeing', severity: 'high',
    });
    expect(created).toBe(false);
    expect(mockCase.create).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

describe('escalateWellbeingIfNeeded', () => {
  test('no-ops when the assessment is fine', async () => {
    const r = await escalateWellbeingIfNeeded({
      schoolId: 'school1', student: { _id: 'stud1', name: 'Sam' },
      wellbeing: { mood: 'good' },
    });
    expect(r.created).toBe(false);
    expect(mockCase.create).not.toHaveBeenCalled();
  });

  test('raises a wellbeing case for a critical mood', async () => {
    mockCase.findOne.mockReturnValue(openCase(null));
    mockCase.create.mockResolvedValue({ _id: 'case1' });
    await escalateWellbeingIfNeeded({
      schoolId: 'school1', student: { _id: 'stud1', name: 'Sam' },
      wellbeing: { mood: 'critical', academicStress: 9 },
    });
    expect(mockCase.create).toHaveBeenCalled();
    expect(mockCase.create.mock.calls[0][0].category).toBe('wellbeing');
  });
});
